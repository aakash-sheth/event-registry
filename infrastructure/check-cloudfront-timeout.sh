#!/bin/bash
# Check CloudFront origin timeout settings
# CloudFront default origin timeout is 30 seconds, max is 60 seconds

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
DISTRIBUTION_ID="${1:-E1O23G36MWQOLT}"

echo "🔍 Checking CloudFront Origin Timeout Settings"
echo "=============================================="
echo ""
echo "Distribution ID: $DISTRIBUTION_ID"
echo ""

# Get distribution config
echo "📋 Current Origin Configuration:"
aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --query "DistributionConfig.Origins.Items[*].{Id:Id,DomainName:DomainName,ConnectionTimeout:ConnectionTimeout,ConnectionAttempts:ConnectionAttempts}" \
  --output table 2>&1 || {
  echo "⚠️  Cannot access CloudFront config (permissions issue)"
  echo ""
  echo "CloudFront Origin Timeout Info:"
  echo "  - Default: 30 seconds"
  echo "  - Maximum: 60 seconds"
  echo "  - If your origin takes longer than 30s, CloudFront will return 504"
  echo ""
  echo "To increase timeout, you need to:"
  echo "  1. Get distribution config (requires cloudfront:GetDistributionConfig permission)"
  echo "  2. Update Origin.ConnectionTimeout (max 60 seconds)"
  echo "  3. Update distribution (takes 15-20 minutes to deploy)"
}

echo ""
echo "💡 Note: CloudFront origin timeout cannot exceed 60 seconds"
echo "   If your origin consistently takes longer, consider:"
echo "   - Optimizing your application response time"
echo "   - Using CloudFront caching more aggressively"
echo "   - Implementing edge functions to reduce origin load"

