#!/bin/bash
# Script to set up distribution configuration using FRONTEND_URL
# Usage: ./setup-distribution.sh
# This script sets FRONTEND_URL as the single source of truth and derives all related parameters

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
PARAM_PREFIX="/event-registry-staging"

echo "🌐 Distribution Setup"
echo "==================="
echo ""
echo "This script sets up SSM parameters based on your frontend URL."
echo "You can use either CloudFront, ALB direct, or a custom domain."
echo ""

# Function to create or update parameter
create_param() {
    local name=$1
    local type=$2
    local value=$3
    local description=$4
    
    echo "  Setting: $name"
    aws ssm put-parameter \
        --name "$name" \
        --type "$type" \
        --value "$value" \
        --description "$description" \
        --region "$AWS_REGION" \
        --overwrite >/dev/null 2>&1 || \
    aws ssm put-parameter \
        --name "$name" \
        --type "$type" \
        --value "$value" \
        --description "$description" \
        --region "$AWS_REGION" >/dev/null 2>&1
}

# Get or prompt for FRONTEND_URL
read -p "Enter FRONTEND_URL (e.g., https://d2lo9ugposplti.cloudfront.net or http://staging-alb-xxx.elb.amazonaws.com): " FRONTEND_URL

if [ -z "$FRONTEND_URL" ]; then
  echo "❌ FRONTEND_URL is required"
  exit 1
fi

# Validate URL format (must include protocol)
if [[ ! $FRONTEND_URL =~ ^https?:// ]]; then
  echo "❌ Invalid FRONTEND_URL format. Must include protocol (http:// or https://)"
  echo "   Example: https://d2lo9ugposplti.cloudfront.net"
  exit 1
fi

# Extract protocol and domain
if [[ $FRONTEND_URL =~ ^(https?://)(.+)$ ]]; then
  PROTOCOL="${BASH_REMATCH[1]}"
  DOMAIN="${BASH_REMATCH[2]}"
else
  echo "❌ Failed to parse FRONTEND_URL"
  exit 1
fi

# Determine distribution type
if [[ $DOMAIN == *"cloudfront.net"* ]]; then
  DISTRIBUTION_TYPE="cloudfront"
  echo "✅ Detected: CloudFront distribution"
elif [[ $DOMAIN == *"elb.amazonaws.com"* ]]; then
  DISTRIBUTION_TYPE="alb"
  echo "✅ Detected: ALB direct"
else
  DISTRIBUTION_TYPE="custom"
  echo "✅ Detected: Custom domain"
fi

# Get ALB DNS (for reference, may be different from FRONTEND_URL)
echo ""
read -p "Enter ALB DNS (for backend reference, optional, e.g., staging-alb-xxx.elb.amazonaws.com): " ALB_DNS
ALB_DNS=${ALB_DNS:-""}

echo ""
echo "📝 Setting SSM parameters..."

# Set FRONTEND_URL (single source of truth)
create_param "${PARAM_PREFIX}/FRONTEND_URL" "String" "$FRONTEND_URL" "Frontend URL - single source of truth for distribution"

# Set DISTRIBUTION_TYPE (optional flag for reference)
create_param "${PARAM_PREFIX}/DISTRIBUTION_TYPE" "String" "$DISTRIBUTION_TYPE" "Distribution type (cloudfront/alb/custom)"

# Derive NEXT_PUBLIC_API_BASE from FRONTEND_URL
# For CloudFront, API calls go through CloudFront (same URL)
# For ALB, API calls go to ALB (use FRONTEND_URL)
NEXT_PUBLIC_API_BASE="$FRONTEND_URL"
create_param "${PARAM_PREFIX}/NEXT_PUBLIC_API_BASE" "String" "$NEXT_PUBLIC_API_BASE" "Frontend API base URL (derived from FRONTEND_URL)"

# Set ALLOWED_HOSTS (just the domain, no protocol)
create_param "${PARAM_PREFIX}/ALLOWED_HOSTS" "String" "$DOMAIN" "Django ALLOWED_HOSTS (domain only, derived from FRONTEND_URL)"

# Set CORS_ALLOWED_ORIGINS (full URL)
create_param "${PARAM_PREFIX}/CORS_ALLOWED_ORIGINS" "String" "$FRONTEND_URL" "CORS allowed origins (derived from FRONTEND_URL)"

# Set FRONTEND_ORIGIN (full URL)
create_param "${PARAM_PREFIX}/FRONTEND_ORIGIN" "String" "$FRONTEND_URL" "Frontend origin URL (derived from FRONTEND_URL)"

# Set ALB_DNS (for reference, if provided)
if [ -n "$ALB_DNS" ]; then
  create_param "${PARAM_PREFIX}/ALB_DNS" "String" "$ALB_DNS" "Application Load Balancer DNS name (for reference)"
fi

echo ""
echo "✅ SSM parameters updated successfully!"
echo ""
echo "Summary:"
echo "  FRONTEND_URL: $FRONTEND_URL"
echo "  DISTRIBUTION_TYPE: $DISTRIBUTION_TYPE"
echo "  NEXT_PUBLIC_API_BASE: $NEXT_PUBLIC_API_BASE"
echo "  ALLOWED_HOSTS: $DOMAIN"
echo "  CORS_ALLOWED_ORIGINS: $FRONTEND_URL"
echo "  FRONTEND_ORIGIN: $FRONTEND_URL"
if [ -n "$ALB_DNS" ]; then
  echo "  ALB_DNS: $ALB_DNS"
fi
echo ""
echo "📦 Next steps:"
echo "  1. Rebuild and redeploy frontend to pick up new NEXT_PUBLIC_API_BASE"
echo "  2. Backend will automatically use updated CORS_ALLOWED_ORIGINS and ALLOWED_HOSTS"
echo ""
echo "To switch distributions later, just run this script again with a different FRONTEND_URL"

