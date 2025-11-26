#!/bin/bash
# Script to set up SSM Parameters for staging environment
# Usage: ./setup-ssm-parameters.sh

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
PARAM_PREFIX="/registry-staging"

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

ALB_URL="https://${ALB_DNS}"
create_param "${PARAM_PREFIX}/NEXT_PUBLIC_API_BASE" "String" "$ALB_URL" "Frontend API base URL"
create_param "${PARAM_PREFIX}/ALLOWED_HOSTS" "String" "$ALB_DNS" "Django ALLOWED_HOSTS"
create_param "${PARAM_PREFIX}/CORS_ALLOWED_ORIGINS" "String" "$ALB_URL" "CORS allowed origins"
create_param "${PARAM_PREFIX}/FRONTEND_ORIGIN" "String" "$ALB_URL" "Frontend origin URL"

# Email configuration
read -p "Enter EMAIL_PROVIDER (ses or sendgrid, default: ses): " EMAIL_PROVIDER
EMAIL_PROVIDER=${EMAIL_PROVIDER:-ses}
create_param "${PARAM_PREFIX}/EMAIL_PROVIDER" "String" "$EMAIL_PROVIDER" "Email provider"

if [ "$EMAIL_PROVIDER" = "ses" ]; then
    read -p "Enter SES_REGION (default: us-east-1): " SES_REGION
    SES_REGION=${SES_REGION:-us-east-1}
    create_param "${PARAM_PREFIX}/SES_REGION" "String" "$SES_REGION" "SES region"
    
    read -p "Enter SES_FROM_EMAIL: " SES_FROM_EMAIL
    create_param "${PARAM_PREFIX}/SES_FROM_EMAIL" "String" "$SES_FROM_EMAIL" "SES from email address"
elif [ "$EMAIL_PROVIDER" = "sendgrid" ]; then
    read -sp "Enter SENDGRID_API_KEY: " SENDGRID_KEY
    echo
    create_param "${PARAM_PREFIX}/SENDGRID_API_KEY" "SecureString" "$SENDGRID_KEY" "SendGrid API key"
    
    read -p "Enter SENDGRID_FROM_EMAIL: " SENDGRID_FROM_EMAIL
    create_param "${PARAM_PREFIX}/SENDGRID_FROM_EMAIL" "String" "$SENDGRID_FROM_EMAIL" "SendGrid from email address"
fi

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

