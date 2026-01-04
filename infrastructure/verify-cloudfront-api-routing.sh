#!/bin/bash
# Script to verify CloudFront routing for /api/* endpoints
# This helps diagnose if CloudFront is correctly routing API requests to the backend

set -e

echo "🔍 CloudFront API Routing Verification"
echo "======================================="
echo ""

DISTRIBUTION_ID="E1O23G36MWQOLT"
DOMAIN="ekfern.com"
ALB_DNS="staging-alb-33342285.us-east-1.elb.amazonaws.com"

echo "📋 Testing API Endpoints"
echo ""

# Test 1: Admin login page (should return Django admin HTML)
echo "1. Testing /api/admin/login/ (should return Django admin login page):"
echo "   CloudFront URL: https://${DOMAIN}/api/admin/login/"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/admin/login/")
if [ "$STATUS" = "200" ]; then
    echo "   ✅ Status: $STATUS (OK)"
    CONTENT=$(curl -s "https://${DOMAIN}/api/admin/login/" | grep -o "Event Registry Administration" | head -1)
    if [ -n "$CONTENT" ]; then
        echo "   ✅ Content: Django admin page detected"
    else
        echo "   ⚠️  Content: Django admin page NOT detected (might be cached frontend page)"
    fi
else
    echo "   ❌ Status: $STATUS (Expected 200)"
fi
echo ""

# Test 2: Health endpoint (should return JSON from backend)
echo "2. Testing /api/health (should return JSON from backend):"
echo "   CloudFront URL: https://${DOMAIN}/api/health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/health")
if [ "$STATUS" = "200" ]; then
    echo "   ✅ Status: $STATUS (OK)"
    RESPONSE=$(curl -s "https://${DOMAIN}/api/health")
    if echo "$RESPONSE" | grep -q "status\|database"; then
        echo "   ✅ Content: Backend JSON response detected"
        echo "   Response: $RESPONSE"
    else
        echo "   ⚠️  Content: Unexpected response format"
        echo "   Response: $RESPONSE"
    fi
else
    echo "   ❌ Status: $STATUS (Expected 200)"
fi
echo ""

# Test 3: Direct ALB access (bypass CloudFront)
echo "3. Testing direct ALB access (bypassing CloudFront):"
echo "   ALB URL: https://${ALB_DNS}/api/admin/login/"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -k "https://${ALB_DNS}/api/admin/login/" 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "000" ]; then
    echo "   ℹ️  Direct ALB access (may require SSL verification bypass)"
    echo "   Note: ALB routing is configured via listener rules"
else
    echo "   ⚠️  Status: $STATUS"
fi
echo ""

# Test 4: Frontend page (should return Next.js HTML)
echo "4. Testing frontend page (should return Next.js HTML):"
echo "   CloudFront URL: https://${DOMAIN}/"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/")
if [ "$STATUS" = "200" ]; then
    echo "   ✅ Status: $STATUS (OK)"
    CONTENT=$(curl -s "https://${DOMAIN}/" | grep -o "Celebrate Mindfully\|Event Registry" | head -1)
    if [ -n "$CONTENT" ]; then
        echo "   ✅ Content: Frontend page detected"
    else
        echo "   ⚠️  Content: Frontend page NOT detected"
    fi
else
    echo "   ❌ Status: $STATUS (Expected 200)"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo ""
echo "CloudFront Distribution ID: $DISTRIBUTION_ID"
echo "Domain: $DOMAIN"
echo "ALB DNS: $ALB_DNS"
echo ""
echo "✅ If all tests pass, CloudFront routing is correct"
echo "⚠️  If admin login page shows frontend content, CloudFront may need cache invalidation"
echo "⚠️  If health endpoint doesn't return JSON, routing may be incorrect"
echo ""
echo "🔧 Next Steps:"
echo "   1. If routing is correct but browser shows wrong page:"
echo "      - Clear browser cache"
echo "      - Try incognito/private browsing"
echo "      - Invalidate CloudFront cache: ./refresh-cloudfront.sh"
echo ""
echo "   2. If routing is incorrect:"
echo "      - Check CloudFront cache behaviors in AWS Console"
echo "      - Ensure /api/* has a cache behavior with CachingDisabled"
echo "      - Verify origin points to ALB"
echo ""


