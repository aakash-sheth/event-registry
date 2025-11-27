#!/bin/bash
# Setup HTTPS for ALB
# This script requests an ACM certificate and configures HTTPS listener

set -e

REGION="us-east-1"
ALB_NAME="staging-alb"
DOMAIN_NAME=""  # Set this to your domain (e.g., staging.example.com) or leave empty for ALB DNS

echo "🔒 Setting up HTTPS for ALB..."

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names $ALB_NAME \
  --region $REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" == "None" ]; then
  echo "❌ Error: ALB '$ALB_NAME' not found"
  exit 1
fi

echo "✅ Found ALB: $ALB_ARN"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $REGION \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "📍 ALB DNS: $ALB_DNS"

# If no domain specified, use ALB DNS
if [ -z "$DOMAIN_NAME" ]; then
  DOMAIN_NAME=$ALB_DNS
  echo "⚠️  No custom domain specified. Using ALB DNS: $DOMAIN_NAME"
  echo "   Note: ACM certificates cannot be issued for ALB DNS names."
  echo "   You'll need to use a custom domain or use a self-signed certificate for testing."
  echo ""
  read -p "Do you have a custom domain? (y/n): " HAS_DOMAIN
  if [ "$HAS_DOMAIN" != "y" ]; then
    echo "❌ Cannot proceed without a custom domain for ACM certificate."
    echo "   Options:"
    echo "   1. Use a custom domain (e.g., staging.yourdomain.com)"
    echo "   2. Use Route 53 to create a subdomain"
    echo "   3. Use a self-signed certificate for testing (not recommended for production)"
    exit 1
  fi
  read -p "Enter your custom domain (e.g., staging.yourdomain.com): " DOMAIN_NAME
fi

echo ""
echo "📋 Certificate will be requested for: $DOMAIN_NAME"
echo "   Make sure this domain is verified in Route 53 or you can add DNS validation records."

# Request ACM certificate
echo ""
echo "📜 Requesting ACM certificate..."
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN_NAME \
  --validation-method DNS \
  --region $REGION \
  --query 'CertificateArn' \
  --output text)

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
  echo "❌ Error: Failed to request certificate"
  exit 1
fi

echo "✅ Certificate requested: $CERT_ARN"
echo ""
echo "⏳ Waiting for certificate validation..."
echo "   You need to add DNS validation records to your domain."
echo "   Get validation records with:"
echo "   aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.DomainValidationOptions'"
echo ""
read -p "Press Enter once the certificate is validated (check in ACM console)..."

# Check certificate status
CERT_STATUS=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --query 'Certificate.Status' \
  --output text)

if [ "$CERT_STATUS" != "ISSUED" ]; then
  echo "⚠️  Certificate status: $CERT_STATUS"
  echo "   Certificate must be ISSUED before proceeding."
  read -p "Continue anyway? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    exit 1
  fi
fi

# Get existing HTTP listener
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --region $REGION \
  --query 'Listeners[?Port==`80`].ListenerArn' \
  --output text)

if [ -z "$HTTP_LISTENER_ARN" ]; then
  echo "❌ Error: HTTP listener (port 80) not found"
  exit 1
fi

echo "✅ Found HTTP listener: $HTTP_LISTENER_ARN"

# Get default action (forward to frontend)
DEFAULT_ACTION=$(aws elbv2 describe-listeners \
  --listener-arns $HTTP_LISTENER_ARN \
  --region $REGION \
  --query 'Listeners[0].DefaultActions[0]' \
  --output json)

# Get target group ARN from default action
FRONTEND_TG_ARN=$(echo $DEFAULT_ACTION | jq -r '.TargetGroupArn')

# Get backend target group ARN (from /api/* rule)
BACKEND_TG_ARN=$(aws elbv2 describe-rules \
  --listener-arn $HTTP_LISTENER_ARN \
  --region $REGION \
  --query 'Rules[?Conditions[0].Values[0]==`/api/*`].Actions[0].TargetGroupArn' \
  --output text)

echo "✅ Frontend target group: $FRONTEND_TG_ARN"
echo "✅ Backend target group: $BACKEND_TG_ARN"

# Create HTTPS listener (port 443)
echo ""
echo "🔐 Creating HTTPS listener (port 443)..."
HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
  --region $REGION \
  --query 'Listeners[0].ListenerArn' \
  --output text)

if [ -z "$HTTPS_LISTENER_ARN" ]; then
  echo "❌ Error: Failed to create HTTPS listener"
  exit 1
fi

echo "✅ HTTPS listener created: $HTTPS_LISTENER_ARN"

# Add rule for /api/* to backend on HTTPS listener
echo ""
echo "📋 Adding /api/* rule to HTTPS listener..."
aws elbv2 create-rule \
  --listener-arn $HTTPS_LISTENER_ARN \
  --priority 100 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
  --region $REGION

echo "✅ Rule added: /api/* → backend"

# Update HTTP listener to redirect to HTTPS
echo ""
echo "🔄 Updating HTTP listener to redirect to HTTPS..."
aws elbv2 modify-listener \
  --listener-arn $HTTP_LISTENER_ARN \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region $REGION

echo "✅ HTTP → HTTPS redirect configured"

echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Update SSM parameter NEXT_PUBLIC_API_BASE to use https://"
echo "   2. Update ALLOWED_HOSTS to include your domain"
echo "   3. Update CORS_ALLOWED_ORIGINS to use https://"
echo "   4. Rebuild and redeploy frontend with new HTTPS URL"
echo ""
echo "   Run these commands:"
echo "   ALB_URL=\"https://$DOMAIN_NAME\""
echo "   aws ssm put-parameter --name \"/event-registry-staging/NEXT_PUBLIC_API_BASE\" --value \"\$ALB_URL\" --type \"String\" --overwrite"
echo "   aws ssm put-parameter --name \"/event-registry-staging/ALLOWED_HOSTS\" --value \"$DOMAIN_NAME\" --type \"String\" --overwrite"
echo "   aws ssm put-parameter --name \"/event-registry-staging/CORS_ALLOWED_ORIGINS\" --value \"\$ALB_URL\" --type \"String\" --overwrite"
echo "   aws ssm put-parameter --name \"/event-registry-staging/FRONTEND_ORIGIN\" --value \"\$ALB_URL\" --type \"String\" --overwrite"

