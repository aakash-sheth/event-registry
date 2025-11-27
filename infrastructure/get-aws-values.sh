#!/bin/bash
# Script to get AWS resource IDs needed for GitHub Actions workflow
# Run this after completing AWS infrastructure setup

set -e

echo "🔍 Gathering AWS Resource IDs for GitHub Actions..."
echo ""

# Get AWS region
REGION=$(aws configure get region || echo "us-east-1")
echo "Region: $REGION"
echo ""

# Get VPC ID (assuming you tagged it)
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=event-registry-staging" \
  --query 'Vpcs[0].VpcId' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$VPC_ID" != "NOT_FOUND" ] && [ "$VPC_ID" != "None" ]; then
  echo "✅ VPC ID: $VPC_ID"
  
  # Get private subnets (for ECS tasks)
  echo ""
  echo "📋 Private Subnets (for ECS tasks):"
  PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=staging-private-*" \
    --query 'Subnets[*].SubnetId' \
    --output text)
  
  if [ -n "$PRIVATE_SUBNETS" ]; then
    echo "$PRIVATE_SUBNETS" | tr '\t' '\n' | nl -v 1
    SUBNET_1=$(echo $PRIVATE_SUBNETS | awk '{print $1}')
    SUBNET_2=$(echo $PRIVATE_SUBNETS | awk '{print $2}')
    echo ""
    echo "Use these in workflow:"
    echo "  subnet-xxx: $SUBNET_1"
    echo "  subnet-yyy: $SUBNET_2"
  else
    echo "⚠️  No private subnets found"
  fi
  
  # Get backend security group
  echo ""
  echo "📋 Security Groups:"
  BACKEND_SG=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=staging-backend-sg" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)
  
  if [ "$BACKEND_SG" != "None" ] && [ -n "$BACKEND_SG" ]; then
    echo "✅ Backend SG: $BACKEND_SG"
    echo "  Use this in workflow: sg-xxx = $BACKEND_SG"
  else
    echo "⚠️  Backend security group not found"
  fi
else
  echo "⚠️  VPC not found. Make sure you've created the VPC with tag Name=event-registry-staging"
fi

# Check ECR repositories
echo ""
echo "📋 ECR Repositories:"
BACKEND_REPO=$(aws ecr describe-repositories \
  --repository-names event-registry-backend-staging \
  --query 'repositories[0].repositoryUri' \
  --output text 2>/dev/null || echo "NOT_FOUND")

FRONTEND_REPO=$(aws ecr describe-repositories \
  --repository-names event-registry-frontend-staging \
  --query 'repositories[0].repositoryUri' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$BACKEND_REPO" != "NOT_FOUND" ] && [ "$BACKEND_REPO" != "None" ]; then
  echo "✅ Backend ECR: $BACKEND_REPO"
else
  echo "❌ Backend ECR repository not found"
fi

if [ "$FRONTEND_REPO" != "NOT_FOUND" ] && [ "$FRONTEND_REPO" != "None" ]; then
  echo "✅ Frontend ECR: $FRONTEND_REPO"
else
  echo "❌ Frontend ECR repository not found"
fi

# Check ECS cluster
echo ""
echo "📋 ECS Cluster:"
CLUSTER=$(aws ecs describe-clusters \
  --clusters event-registry-staging \
  --query 'clusters[0].clusterName' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CLUSTER" != "NOT_FOUND" ] && [ "$CLUSTER" != "None" ]; then
  echo "✅ ECS Cluster: $CLUSTER"
else
  echo "❌ ECS cluster 'event-registry-staging' not found"
fi

# Check ECS services
echo ""
echo "📋 ECS Services:"
BACKEND_SERVICE=$(aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --query 'services[0].serviceName' \
  --output text 2>/dev/null || echo "NOT_FOUND")

FRONTEND_SERVICE=$(aws ecs describe-services \
  --cluster event-registry-staging \
  --services frontend-service \
  --query 'services[0].serviceName' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$BACKEND_SERVICE" != "NOT_FOUND" ] && [ "$BACKEND_SERVICE" != "None" ]; then
  echo "✅ Backend Service: $BACKEND_SERVICE"
else
  echo "❌ Backend service not found"
fi

if [ "$FRONTEND_SERVICE" != "NOT_FOUND" ] && [ "$FRONTEND_SERVICE" != "None" ]; then
  echo "✅ Frontend Service: $FRONTEND_SERVICE"
else
  echo "❌ Frontend service not found"
fi

# Check task definitions
echo ""
echo "📋 Task Definitions:"
BACKEND_TASK=$(aws ecs describe-task-definition \
  --task-definition backend-task \
  --query 'taskDefinition.family' \
  --output text 2>/dev/null || echo "NOT_FOUND")

FRONTEND_TASK=$(aws ecs describe-task-definition \
  --task-definition frontend-task \
  --query 'taskDefinition.family' \
  --output text 2>/dev/null || echo "NOT_FOUND")

MIGRATION_TASK=$(aws ecs describe-task-definition \
  --task-definition backend-migration-task \
  --query 'taskDefinition.family' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$BACKEND_TASK" != "NOT_FOUND" ] && [ "$BACKEND_TASK" != "None" ]; then
  echo "✅ Backend Task: $BACKEND_TASK"
else
  echo "❌ Backend task definition not found"
fi

if [ "$FRONTEND_TASK" != "NOT_FOUND" ] && [ "$FRONTEND_TASK" != "None" ]; then
  echo "✅ Frontend Task: $FRONTEND_TASK"
else
  echo "❌ Frontend task definition not found"
fi

if [ "$MIGRATION_TASK" != "NOT_FOUND" ] && [ "$MIGRATION_TASK" != "None" ]; then
  echo "✅ Migration Task: $MIGRATION_TASK"
else
  echo "⚠️  Migration task definition not found (you can create it or use backend-task)"
fi

# Check SSM parameters
echo ""
echo "📋 SSM Parameters:"
ALB_DNS_PARAM=$(aws ssm get-parameter \
  --name "/event-registry-staging/ALB_DNS" \
  --query 'Parameter.Name' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$ALB_DNS_PARAM" != "NOT_FOUND" ] && [ "$ALB_DNS_PARAM" != "None" ]; then
  ALB_DNS_VALUE=$(aws ssm get-parameter \
    --name "/event-registry-staging/ALB_DNS" \
    --query 'Parameter.Value' \
    --output text)
  echo "✅ ALB_DNS parameter exists: $ALB_DNS_VALUE"
else
  echo "❌ ALB_DNS parameter not found at /event-registry-staging/ALB_DNS"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Summary for GitHub Actions Workflow:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Update .github/workflows/deploy-staging.yml line 64:"
echo "  Replace subnet-xxx with: $SUBNET_1"
echo "  Replace subnet-yyy with: $SUBNET_2"
echo "  Replace sg-xxx with: $BACKEND_SG"
echo ""
echo "Prerequisites Status:"
echo "  ECR Repositories: $([ "$BACKEND_REPO" != "NOT_FOUND" ] && echo "✅" || echo "❌")"
echo "  ECS Cluster: $([ "$CLUSTER" != "NOT_FOUND" ] && echo "✅" || echo "❌")"
echo "  ECS Services: $([ "$BACKEND_SERVICE" != "NOT_FOUND" ] && [ "$FRONTEND_SERVICE" != "NOT_FOUND" ] && echo "✅" || echo "❌")"
echo "  Task Definitions: $([ "$BACKEND_TASK" != "NOT_FOUND" ] && [ "$FRONTEND_TASK" != "NOT_FOUND" ] && echo "✅" || echo "❌")"
echo "  SSM ALB_DNS: $([ "$ALB_DNS_PARAM" != "NOT_FOUND" ] && echo "✅" || echo "❌")"
echo ""

