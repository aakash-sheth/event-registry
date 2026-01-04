#!/bin/bash
# Update CloudFront origin timeout to 60 seconds (maximum)
# CloudFront default is 30 seconds, which can cause 504 errors if origin takes longer

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
DISTRIBUTION_ID="${1:-}"

# Get distribution ID from SSM if not provided
if [ -z "$DISTRIBUTION_ID" ]; then
  echo "🔍 Looking up CloudFront Distribution ID from SSM..."
  DISTRIBUTION_ID=$(aws ssm get-parameter \
    --name "/event-registry-staging/CLOUDFRONT_DISTRIBUTION_ID" \
    --region "$AWS_REGION" \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$DISTRIBUTION_ID" ]; then
    echo "❌ Could not find CloudFront Distribution ID in SSM"
    echo ""
    echo "Usage: $0 <distribution-id>"
    echo "   Or set CLOUDFRONT_DISTRIBUTION_ID in SSM parameter: /event-registry-staging/CLOUDFRONT_DISTRIBUTION_ID"
    exit 1
  fi
fi

echo "🔧 Updating CloudFront Origin Timeout"
echo "======================================"
echo ""
echo "Distribution ID: $DISTRIBUTION_ID"
echo "Target Timeout: 60 seconds (maximum)"
echo ""

# Get current distribution config
echo "📋 Fetching current distribution configuration..."
CONFIG_FILE=$(mktemp)
ETAG_FILE=$(mktemp)

aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --region "$AWS_REGION" \
  --output json > "$CONFIG_FILE" || {
  echo "❌ Failed to get distribution config"
  echo "   Required permissions: cloudfront:GetDistributionConfig"
  exit 1
}

# Extract ETag (required for update)
ETAG=$(jq -r '.ETag' "$CONFIG_FILE")
echo "$ETAG" > "$ETAG_FILE"

# Extract distribution config
DIST_CONFIG=$(jq -r '.DistributionConfig' "$CONFIG_FILE")

# Check current timeout settings
echo ""
echo "📊 Current Origin Timeout Settings:"
ORIGINS=$(echo "$DIST_CONFIG" | jq -r '.Origins.Items[] | "  \(.Id): \(.ConnectionTimeout // 30) seconds"')
echo "$ORIGINS"

# Update all origins to 60 seconds
echo ""
echo "🔧 Updating all origins to 60 seconds timeout..."

UPDATED_CONFIG=$(echo "$DIST_CONFIG" | jq '
  .Origins.Items = (.Origins.Items | map(
    .ConnectionTimeout = 60 |
    .ConnectionAttempts = 3
  ))
')

# Save updated config to temp file
UPDATED_CONFIG_FILE=$(mktemp)
echo "$UPDATED_CONFIG" > "$UPDATED_CONFIG_FILE"

# Verify the update
echo ""
echo "✅ Updated Origin Timeout Settings:"
UPDATED_ORIGINS=$(echo "$UPDATED_CONFIG" | jq -r '.Origins.Items[] | "  \(.Id): \(.ConnectionTimeout) seconds"')
echo "$UPDATED_ORIGINS"

# Confirm before updating
echo ""
read -p "⚠️  This will update the CloudFront distribution (takes 15-20 minutes to deploy). Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Update cancelled"
  rm -f "$CONFIG_FILE" "$ETAG_FILE" "$UPDATED_CONFIG_FILE"
  exit 0
fi

# Update distribution
echo ""
echo "🚀 Updating CloudFront distribution..."
echo "   This will take 15-20 minutes to deploy globally..."

aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --distribution-config file://"$UPDATED_CONFIG_FILE" \
  --if-match "$ETAG" \
  --region "$AWS_REGION" > /dev/null || {
  echo "❌ Failed to update distribution"
  echo "   Required permissions: cloudfront:UpdateDistribution"
  rm -f "$CONFIG_FILE" "$ETAG_FILE" "$UPDATED_CONFIG_FILE"
  exit 1
}

echo ""
echo "✅ Distribution update initiated successfully!"
echo ""
echo "📋 Next Steps:"
echo "   1. Wait 15-20 minutes for the update to deploy globally"
echo "   2. Monitor CloudFront console for deployment status"
echo "   3. Test your application after deployment completes"
echo ""
echo "💡 To check deployment status:"
echo "   aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status' --output text"
echo ""
echo "💡 To check current timeout settings:"
echo "   ./infrastructure/check-cloudfront-timeout.sh $DISTRIBUTION_ID"
echo ""

# Cleanup
rm -f "$CONFIG_FILE" "$ETAG_FILE" "$UPDATED_CONFIG_FILE"


