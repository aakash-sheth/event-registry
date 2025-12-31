#!/bin/bash
# Script to set up SSM Parameters for staging environment
# Usage: ./setup-ssm-parameters.sh

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
PARAM_PREFIX="/event-registry-staging"

echo "Setting up SSM Parameters for staging environment..."

# Function to create parameter
create_param() {
    local name=$1
    local type=$2
    local value=$3
    local description=$4
    
    echo "Creating parameter: $name"
    aws ssm put-parameter \
        --name "$name" \
        --type "$type" \
        --value "$value" \
        --description "$description" \
        --region "$AWS_REGION" \
        --overwrite 2>/dev/null || \
    aws ssm put-parameter \
        --name "$name" \
        --type "$type" \
        --value "$value" \
        --description "$description" \
        --region "$AWS_REGION"
}

# SecureString parameters (sensitive)
read -sp "Enter DJANGO_SECRET_KEY: " DJANGO_SECRET_KEY
echo
create_param "${PARAM_PREFIX}/DJANGO_SECRET_KEY" "SecureString" "$DJANGO_SECRET_KEY" "Django secret key"

read -sp "Enter DATABASE_URL: " DATABASE_URL
echo
create_param "${PARAM_PREFIX}/DATABASE_URL" "SecureString" "$DATABASE_URL" "PostgreSQL database connection URL"

# String parameters (non-sensitive)
read -p "Enter AWS_S3_BUCKET name: " S3_BUCKET
create_param "${PARAM_PREFIX}/AWS_S3_BUCKET" "String" "$S3_BUCKET" "S3 bucket for image uploads"

read -p "Enter AWS_S3_REGION (default: us-east-1): " S3_REGION
S3_REGION=${S3_REGION:-us-east-1}
create_param "${PARAM_PREFIX}/AWS_S3_REGION" "String" "$S3_REGION" "S3 region"

read -p "Enter ALB DNS name (e.g., staging-alb-123456789.us-east-1.elb.amazonaws.com): " ALB_DNS
create_param "${PARAM_PREFIX}/ALB_DNS" "String" "$ALB_DNS" "Application Load Balancer DNS name"

# Optional: Support FRONTEND_URL for flexible distribution (CloudFront, custom domain, etc.)
echo ""
read -p "Do you want to set a custom FRONTEND_URL? (y/n, default: n): " USE_CUSTOM_FRONTEND
USE_CUSTOM_FRONTEND=${USE_CUSTOM_FRONTEND:-n}

if [ "$USE_CUSTOM_FRONTEND" = "y" ] || [ "$USE_CUSTOM_FRONTEND" = "Y" ]; then
  read -p "Enter FRONTEND_URL (e.g., https://d2lo9ugposplti.cloudfront.net or https://staging.example.com): " FRONTEND_URL
  
  if [ -z "$FRONTEND_URL" ]; then
    echo "⚠️  FRONTEND_URL is empty, falling back to ALB URL"
    FRONTEND_URL="https://${ALB_DNS}"
  fi
  
  # Extract domain from FRONTEND_URL
  if [[ $FRONTEND_URL =~ ^https?://(.+)$ ]]; then
    FRONTEND_DOMAIN="${BASH_REMATCH[1]}"
  else
    FRONTEND_DOMAIN="$FRONTEND_URL"
  fi
  
  # Detect distribution type
  if [[ $FRONTEND_DOMAIN == *"cloudfront.net"* ]]; then
    DISTRIBUTION_TYPE="cloudfront"
  elif [[ $FRONTEND_DOMAIN == *"elb.amazonaws.com"* ]]; then
    DISTRIBUTION_TYPE="alb"
  else
    DISTRIBUTION_TYPE="custom"
  fi
  
  # Set FRONTEND_URL as single source of truth
  create_param "${PARAM_PREFIX}/FRONTEND_URL" "String" "$FRONTEND_URL" "Frontend URL - single source of truth for distribution"
  create_param "${PARAM_PREFIX}/DISTRIBUTION_TYPE" "String" "$DISTRIBUTION_TYPE" "Distribution type (cloudfront/alb/custom)"
  
  # Derive all parameters from FRONTEND_URL
  create_param "${PARAM_PREFIX}/NEXT_PUBLIC_API_BASE" "String" "$FRONTEND_URL" "Frontend API base URL (derived from FRONTEND_URL)"
  create_param "${PARAM_PREFIX}/ALLOWED_HOSTS" "String" "$FRONTEND_DOMAIN" "Django ALLOWED_HOSTS (derived from FRONTEND_URL)"
  create_param "${PARAM_PREFIX}/CORS_ALLOWED_ORIGINS" "String" "$FRONTEND_URL" "CORS allowed origins (derived from FRONTEND_URL)"
  create_param "${PARAM_PREFIX}/FRONTEND_ORIGIN" "String" "$FRONTEND_URL" "Frontend origin URL (derived from FRONTEND_URL)"
  
  echo "✅ Using FRONTEND_URL: $FRONTEND_URL"
else
  # Legacy behavior: construct from ALB_DNS
ALB_URL="https://${ALB_DNS}"
create_param "${PARAM_PREFIX}/NEXT_PUBLIC_API_BASE" "String" "$ALB_URL" "Frontend API base URL"
create_param "${PARAM_PREFIX}/ALLOWED_HOSTS" "String" "$ALB_DNS" "Django ALLOWED_HOSTS"
create_param "${PARAM_PREFIX}/CORS_ALLOWED_ORIGINS" "String" "$ALB_URL" "CORS allowed origins"
create_param "${PARAM_PREFIX}/FRONTEND_ORIGIN" "String" "$ALB_URL" "Frontend origin URL"
  
  echo "✅ Using ALB URL: $ALB_URL"
fi

# Email configuration (AWS SES only)
read -p "Enter SES_REGION (default: us-east-1): " SES_REGION
SES_REGION=${SES_REGION:-us-east-1}
create_param "${PARAM_PREFIX}/SES_REGION" "String" "$SES_REGION" "SES region"

read -p "Enter SES_FROM_EMAIL: " SES_FROM_EMAIL
create_param "${PARAM_PREFIX}/SES_FROM_EMAIL" "String" "$SES_FROM_EMAIL" "SES from email address"

# Feature flags
read -p "Enable WhatsApp? (true/false, default: false): " WHATSAPP_ENABLED
WHATSAPP_ENABLED=${WHATSAPP_ENABLED:-false}
create_param "${PARAM_PREFIX}/WHATSAPP_ENABLED" "String" "$WHATSAPP_ENABLED" "WhatsApp feature flag"

# Debug mode
create_param "${PARAM_PREFIX}/DEBUG" "String" "False" "Django DEBUG setting"

# Future Razorpay parameters (commented out for now)
# read -p "Enter RAZORPAY_KEY_ID (optional, for future use): " RAZORPAY_KEY_ID
# if [ -n "$RAZORPAY_KEY_ID" ]; then
#     create_param "${PARAM_PREFIX}/RAZORPAY_KEY_ID" "String" "$RAZORPAY_KEY_ID" "Razorpay key ID"
# fi

echo ""
echo "SSM Parameters created successfully!"
echo "List all parameters: aws ssm get-parameters-by-path --path ${PARAM_PREFIX} --region ${AWS_REGION}"

