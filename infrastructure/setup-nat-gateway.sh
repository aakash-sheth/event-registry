#!/bin/bash

# Script to set up NAT Gateway for hybrid approach (cost + security optimization)
# This implements the recommended solution: Keep SSM/ECR endpoints, remove SES/Logs endpoints, add NAT Gateway

set -e

# Configuration
REGION="us-east-1"
VPC_ID="vpc-0150736050b2f8bc7"
PUBLIC_SUBNET_1="subnet-00903760b47ea9f39"  # staging-public-1 (us-east-1a)
PUBLIC_SUBNET_2="subnet-0781ee8d36f10d08e"  # staging-public-2 (us-east-1b)
PRIVATE_ROUTE_TABLE="rtb-0f4d2c9b994b1e666"  # Associated with both private subnets

# VPC Endpoints to remove
SES_ENDPOINT="vpce-0769d97cbd52f291a"
CLOUDWATCH_LOGS_ENDPOINT="vpce-000f91d500fb53cd0"

echo "🚀 Setting up NAT Gateway for hybrid approach"
echo "=============================================="
echo ""
echo "Configuration:"
echo "  VPC: $VPC_ID"
echo "  Region: $REGION"
echo "  Public Subnet (for NAT): $PUBLIC_SUBNET_1"
echo "  Private Route Table: $PRIVATE_ROUTE_TABLE"
echo ""

# Step 1: Allocate Elastic IP for NAT Gateway
echo "📌 Step 1: Allocating Elastic IP for NAT Gateway..."
EIP_ALLOCATION=$(aws ec2 allocate-address \
  --domain vpc \
  --region $REGION \
  --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=event-registry-staging-nat-gateway}]" \
  --query 'AllocationId' \
  --output text)

if [ -z "$EIP_ALLOCATION" ] || [ "$EIP_ALLOCATION" = "None" ]; then
  echo "❌ Failed to allocate Elastic IP"
  exit 1
fi

echo "✅ Elastic IP allocated: $EIP_ALLOCATION"
EIP_ADDRESS=$(aws ec2 describe-addresses --region $REGION --allocation-ids $EIP_ALLOCATION --query 'Addresses[0].PublicIp' --output text)
echo "   Public IP: $EIP_ADDRESS"
echo ""

# Step 2: Create NAT Gateway
echo "📌 Step 2: Creating NAT Gateway..."
NAT_GATEWAY_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $EIP_ALLOCATION \
  --region $REGION \
  --query 'NatGateway.NatGatewayId' \
  --output text)

# Tag the NAT Gateway
if [ ! -z "$NAT_GATEWAY_ID" ] && [ "$NAT_GATEWAY_ID" != "None" ]; then
  aws ec2 create-tags \
    --resources $NAT_GATEWAY_ID \
    --tags Key=Name,Value=event-registry-staging-nat-gateway \
    --region $REGION
fi

if [ -z "$NAT_GATEWAY_ID" ] || [ "$NAT_GATEWAY_ID" = "None" ]; then
  echo "❌ Failed to create NAT Gateway"
  exit 1
fi

echo "✅ NAT Gateway created: $NAT_GATEWAY_ID"
echo "   Waiting for NAT Gateway to become available (this may take 2-5 minutes)..."
echo ""

# Wait for NAT Gateway to become available
MAX_WAIT=300  # 5 minutes
WAIT_TIME=0
while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  STATUS=$(aws ec2 describe-nat-gateways \
    --region $REGION \
    --nat-gateway-ids $NAT_GATEWAY_ID \
    --query 'NatGateways[0].State' \
    --output text)
  
  if [ "$STATUS" = "available" ]; then
    echo "✅ NAT Gateway is now available!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ NAT Gateway creation failed"
    exit 1
  fi
  
  sleep 10
  WAIT_TIME=$((WAIT_TIME + 10))
  echo "   Waiting... ($WAIT_TIME/$MAX_WAIT seconds) - Status: $STATUS"
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
  echo "⏳ Timeout waiting for NAT Gateway. It may still be provisioning."
  echo "   You can check status with: aws ec2 describe-nat-gateways --nat-gateway-ids $NAT_GATEWAY_ID --region $REGION"
fi

echo ""

# Step 3: Update private route table to route internet traffic through NAT Gateway
echo "📌 Step 3: Updating private route table to route 0.0.0.0/0 through NAT Gateway..."
aws ec2 create-route \
  --route-table-id $PRIVATE_ROUTE_TABLE \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GATEWAY_ID \
  --region $REGION 2>/dev/null || \
aws ec2 replace-route \
  --route-table-id $PRIVATE_ROUTE_TABLE \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GATEWAY_ID \
  --region $REGION

echo "✅ Private route table updated"
echo ""

# Step 4: Remove SES and CloudWatch Logs VPC endpoints
echo "📌 Step 4: Removing SES and CloudWatch Logs VPC endpoints (will use NAT Gateway instead)..."
aws ec2 delete-vpc-endpoints \
  --vpc-endpoint-ids $SES_ENDPOINT $CLOUDWATCH_LOGS_ENDPOINT \
  --region $REGION

echo "✅ VPC endpoint deletions initiated:"
echo "   - SES: $SES_ENDPOINT"
echo "   - CloudWatch Logs: $CLOUDWATCH_LOGS_ENDPOINT"
echo "   (This may take a few minutes to complete)"
echo ""

# Summary
echo "=============================================="
echo "✅ NAT Gateway Setup Complete!"
echo "=============================================="
echo ""
echo "Summary:"
echo "  ✓ NAT Gateway created: $NAT_GATEWAY_ID"
echo "  ✓ Elastic IP: $EIP_ADDRESS ($EIP_ALLOCATION)"
echo "  ✓ Private route table updated"
echo "  ✓ SES endpoint deletion initiated"
echo "  ✓ CloudWatch Logs endpoint deletion initiated"
echo ""
echo "Kept VPC Endpoints (Security Critical):"
echo "  ✓ SSM endpoint (for secrets)"
echo "  ✓ ECR endpoints (for Docker image pulls)"
echo "  ✓ S3 Gateway endpoint (free)"
echo ""
echo "Next Steps:"
echo "  1. Wait 2-5 minutes for NAT Gateway to fully provision"
echo "  2. Wait for VPC endpoint deletions to complete"
echo "  3. Test ALB connectivity from frontend service"
echo "  4. Monitor CloudWatch logs to verify SES and CloudWatch Logs work via NAT Gateway"
echo ""
echo "To verify NAT Gateway status:"
echo "  aws ec2 describe-nat-gateways --nat-gateway-ids $NAT_GATEWAY_ID --region $REGION"
echo ""
echo "To check route table:"
echo "  aws ec2 describe-route-tables --route-table-ids $PRIVATE_ROUTE_TABLE --region $REGION"
echo ""

