#!/bin/bash
# Utility script to refresh (invalidate) CloudFront cache on demand
# Usage: ./refresh-cloudfront.sh [distribution-id]
# If distribution-id is not provided, it will be looked up from SSM or FRONTEND_URL

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
PARAM_PREFIX="/event-registry-staging"

echo "🔄 CloudFront Cache Invalidation"
echo "================================"
echo ""

# Function to get distribution ID from SSM
get_distribution_id_from_ssm() {
  aws ssm get-parameter \
    --name "${PARAM_PREFIX}/CLOUDFRONT_DISTRIBUTION_ID" \
    --query "Parameter.Value" \
    --output text 2>/dev/null || echo ""
}

# Function to find distribution by domain
find_distribution_by_domain() {
  local domain=$1
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items[?@=='$domain'] || DomainName=='$domain'].Id" \
    --output text 2>/dev/null | head -1
}

# Check if distribution ID was provided as argument
if [ -n "$1" ]; then
  DISTRIBUTION_ID="$1"
  echo "✅ Using provided distribution ID: $DISTRIBUTION_ID"
else
  # Try to get from SSM parameter
  DISTRIBUTION_ID=$(get_distribution_id_from_ssm)
  
  if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    echo "✅ Found distribution ID from SSM: $DISTRIBUTION_ID"
  else
    # Try to find by FRONTEND_URL
    FRONTEND_URL=$(aws ssm get-parameter \
      --name "${PARAM_PREFIX}/FRONTEND_URL" \
      --query "Parameter.Value" \
      --output text 2>/dev/null || echo "")
    
    if [ -z "$FRONTEND_URL" ] || [ "$FRONTEND_URL" == "None" ]; then
      echo "❌ Could not determine CloudFront distribution"
      echo ""
      echo "Options:"
      echo "  1. Pass distribution ID as argument:"
      echo "     ./refresh-cloudfront.sh E1O23G36MWQOLT"
      echo ""
      echo "  2. Set CLOUDFRONT_DISTRIBUTION_ID in SSM:"
      echo "     aws ssm put-parameter \\"
      echo "       --name \"${PARAM_PREFIX}/CLOUDFRONT_DISTRIBUTION_ID\" \\"
      echo "       --value \"E1O23G36MWQOLT\" \\"
      echo "       --type \"String\" \\"
      echo "       --overwrite"
      echo ""
      echo "  3. Set FRONTEND_URL in SSM (will be used to find distribution)"
      exit 1
    fi
    
    # Extract domain from FRONTEND_URL
    if [[ $FRONTEND_URL =~ ^https?://(.+)$ ]]; then
      FRONTEND_DOMAIN="${BASH_REMATCH[1]}"
    else
      FRONTEND_DOMAIN="$FRONTEND_URL"
    fi
    
    echo "🔍 Looking for CloudFront distribution with domain: $FRONTEND_DOMAIN"
    DISTRIBUTION_ID=$(find_distribution_by_domain "$FRONTEND_DOMAIN")
    
    if [ -z "$DISTRIBUTION_ID" ] || [ "$DISTRIBUTION_ID" == "None" ]; then
      echo "❌ CloudFront distribution not found for domain: $FRONTEND_DOMAIN"
      echo ""
      echo "Please provide distribution ID manually:"
      echo "  ./refresh-cloudfront.sh E1O23G36MWQOLT"
      exit 1
    fi
    
    echo "✅ Found distribution ID: $DISTRIBUTION_ID"
  fi
fi

# Validate distribution ID format (CloudFront IDs are typically 13-14 alphanumeric characters)
if [[ ! $DISTRIBUTION_ID =~ ^[A-Z0-9]{13,14}$ ]]; then
  echo "❌ Invalid distribution ID format: $DISTRIBUTION_ID"
  echo "   Expected format: 13-14 alphanumeric characters (e.g., E1O23G36MWQOLT)"
  exit 1
fi

# Get distribution details for confirmation
echo ""
echo "📋 Distribution details:"
DIST_INFO=$(aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query 'Distribution.{DomainName:DomainName,Status:Status,Comment:Comment}' \
  --output json 2>/dev/null || echo "{}")

if [ "$DIST_INFO" != "{}" ]; then
  echo "$DIST_INFO" | jq -r '. | "  Domain: \(.DomainName)\n  Status: \(.Status)\n  Comment: \(.Comment // "N/A")"'
else
  echo "  ⚠️  Could not fetch distribution details (may not have permissions)"
fi

# Ask for confirmation
echo ""
read -p "Invalidate cache for all paths (/*)? (y/n, default: y): " CONFIRM
CONFIRM=${CONFIRM:-y}

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "❌ Cancelled"
  exit 0
fi

# Create invalidation
echo ""
echo "🔄 Creating cache invalidation..."
INVALIDATION=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --output json 2>/dev/null)

if [ $? -eq 0 ]; then
  INVALIDATION_ID=$(echo "$INVALIDATION" | jq -r '.Invalidation.Id')
  STATUS=$(echo "$INVALIDATION" | jq -r '.Invalidation.Status')
  CREATE_TIME=$(echo "$INVALIDATION" | jq -r '.Invalidation.CreateTime')
  
  echo "✅ Cache invalidation created successfully!"
  echo ""
  echo "  Invalidation ID: $INVALIDATION_ID"
  echo "  Status: $STATUS"
  echo "  Created: $CREATE_TIME"
  echo "  Paths: /* (all paths)"
  echo ""
  
  # Wait for completion (with timeout)
  if [ "$STATUS" != "Completed" ]; then
    echo "⏳ Waiting for invalidation to complete (max 5 minutes)..."
    echo ""
    
    MAX_WAIT=300  # 5 minutes in seconds
    CHECK_INTERVAL=15  # Check every 15 seconds
    ELAPSED=0
    
    while [ $ELAPSED -lt $MAX_WAIT ]; do
      sleep $CHECK_INTERVAL
      ELAPSED=$((ELAPSED + CHECK_INTERVAL))
      
      # Check current status
      CURRENT_STATUS=$(aws cloudfront get-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID" \
        --query 'Invalidation.Status' \
        --output text 2>/dev/null || echo "Unknown")
      
      if [ "$CURRENT_STATUS" == "Completed" ]; then
        echo "✅ Invalidation completed successfully!"
        echo "   Total time: $((ELAPSED / 60))m $((ELAPSED % 60))s"
        exit 0
      elif [ "$CURRENT_STATUS" == "InProgress" ]; then
        echo "   ⏳ Still in progress... ($((ELAPSED / 60))m $((ELAPSED % 60))s elapsed)"
      else
        echo "   ℹ️  Status: $CURRENT_STATUS"
      fi
    done
    
    # Timeout reached
    FINAL_STATUS=$(aws cloudfront get-invalidation \
      --distribution-id "$DISTRIBUTION_ID" \
      --id "$INVALIDATION_ID" \
      --query 'Invalidation.Status' \
      --output text 2>/dev/null || echo "Unknown")
    
    echo ""
    if [ "$FINAL_STATUS" == "Completed" ]; then
      echo "✅ Invalidation completed (checked after timeout)"
    else
      echo "⏳ Timeout reached (5 minutes). Invalidation may still be in progress."
      echo "   Current status: $FINAL_STATUS"
      echo "   Check manually: aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
    fi
  else
    echo "✅ Invalidation already completed!"
  fi
else
  echo "❌ Failed to create cache invalidation"
  exit 1
fi

