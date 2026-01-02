#!/bin/bash
# Diagnostic script for invite page production issues
# Usage: ./infrastructure/diagnose-invite-issues.sh <slug>
# Example: ./infrastructure/diagnose-invite-issues.sh aakash-alisha

set -e

SLUG="${1:-aakash-alisha}"
PARAM_PREFIX="/event-registry-staging"
REGION="us-east-1"

echo "🔍 Diagnosing invite page issues for slug: $SLUG"
echo "=" | awk '{printf "=%.0s", $1; for(i=1;i<=60;i++) printf "="; print ""}'
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check SSM parameter
check_ssm_param() {
    local param_name="$1"
    local description="$2"
    
    echo "📋 Checking SSM parameter: $param_name"
    local value=$(aws ssm get-parameter --name "$param_name" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    
    if [ -z "$value" ]; then
        echo -e "${RED}❌ NOT SET${NC}"
        echo "   Description: $description"
        return 1
    else
        echo -e "${GREEN}✅ SET${NC}"
        echo "   Value: $value"
        
        # Check if it points to CloudFront (potential loop)
        if echo "$value" | grep -qE "(cloudfront|ekfern\.com)"; then
            echo -e "${YELLOW}⚠️  WARNING: Points to CloudFront/frontend URL!${NC}"
            echo "   This will cause SSR routing loop if used as BACKEND_API_BASE"
            return 2
        fi
        
        # Check if it's a valid URL
        if ! echo "$value" | grep -qE "^https?://"; then
            echo -e "${YELLOW}⚠️  WARNING: Not a valid URL format${NC}"
            return 2
        fi
        
        return 0
    fi
}

# Function to check ECS task environment
check_ecs_env() {
    echo ""
    echo "🐳 Checking ECS Frontend Task Environment Variables"
    echo "---------------------------------------------------"
    
    # Get cluster name
    CLUSTER_NAME=$(aws ssm get-parameter --name "${PARAM_PREFIX}/ECS_CLUSTER_NAME" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "event-registry-staging")
    
    # Get service name
    SERVICE_NAME="frontend-service"
    
    # Get running task ARN
    TASK_ARN=$(aws ecs list-tasks \
        --cluster "$CLUSTER_NAME" \
        --service-name "$SERVICE_NAME" \
        --region "$REGION" \
        --query "taskArns[0]" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
        echo -e "${YELLOW}⚠️  Could not find running frontend task${NC}"
        echo "   Cluster: $CLUSTER_NAME"
        echo "   Service: $SERVICE_NAME"
        return 1
    fi
    
    echo "   Task ARN: $TASK_ARN"
    echo ""
    
    # Get task definition
    TASK_DEF=$(aws ecs describe-tasks \
        --cluster "$CLUSTER_NAME" \
        --tasks "$TASK_ARN" \
        --region "$REGION" \
        --query "tasks[0].taskDefinitionArn" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$TASK_DEF" ] && [ "$TASK_DEF" != "None" ]; then
        echo "   Task Definition: $TASK_DEF"
        
        # Check if BACKEND_API_BASE is in secrets
        echo ""
        echo "   Checking task definition for BACKEND_API_BASE..."
        HAS_BACKEND_API_BASE=$(aws ecs describe-task-definition \
            --task-definition "$TASK_DEF" \
            --region "$REGION" \
            --query "taskDefinition.containerDefinitions[0].secrets[?name=='BACKEND_API_BASE']" \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$HAS_BACKEND_API_BASE" ]; then
            echo -e "${GREEN}✅ BACKEND_API_BASE is configured in task definition${NC}"
        else
            echo -e "${RED}❌ BACKEND_API_BASE is NOT configured in task definition${NC}"
            echo "   This is the most likely cause of SSR routing loops!"
        fi
    fi
    
    echo ""
    echo "   Note: To see actual runtime environment variables, check CloudWatch logs"
    echo "   Log Group: /ecs/event-registry-staging/frontend"
}

# Function to check invite page status
check_invite_page() {
    echo ""
    echo "📄 Checking Invite Page Status in Database"
    echo "-------------------------------------------"
    
    # Get cluster and task definition for backend
    CLUSTER_NAME=$(aws ssm get-parameter --name "${PARAM_PREFIX}/ECS_CLUSTER_NAME" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "event-registry-staging")
    
    # Run check_invite_page command via ECS exec or one-off task
    echo "   Running: python manage.py check_invite_page $SLUG"
    echo ""
    echo -e "${YELLOW}⚠️  To check invite page status, run this command:${NC}"
    echo ""
    echo "   # Option 1: Via ECS Exec (if enabled)"
    echo "   aws ecs execute-command \\"
    echo "     --cluster $CLUSTER_NAME \\"
    echo "     --task <backend-task-arn> \\"
    echo "     --container backend \\"
    echo "     --command \"python manage.py check_invite_page $SLUG\" \\"
    echo "     --interactive"
    echo ""
    echo "   # Option 2: Via one-off ECS task"
    echo "   # (Create a migration/management task and run it)"
    echo ""
}

# Function to check API endpoints
check_api_endpoints() {
    echo ""
    echo "🌐 Checking API Endpoints"
    echo "-------------------------"
    
    # Get URLs
    FRONTEND_URL=$(aws ssm get-parameter --name "${PARAM_PREFIX}/FRONTEND_URL" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    BACKEND_API_BASE=$(aws ssm get-parameter --name "${PARAM_PREFIX}/BACKEND_API_BASE" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    ALB_DNS=$(aws ssm get-parameter --name "${PARAM_PREFIX}/ALB_DNS" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    
    # Test invite endpoint via CloudFront
    if [ -n "$FRONTEND_URL" ]; then
        echo "   Testing via CloudFront: ${FRONTEND_URL}/api/events/invite/${SLUG}/"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${FRONTEND_URL}/api/events/invite/${SLUG}/" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" == "200" ]; then
            echo -e "${GREEN}✅ CloudFront API endpoint returns 200${NC}"
        elif [ "$HTTP_CODE" == "404" ]; then
            echo -e "${YELLOW}⚠️  CloudFront API endpoint returns 404${NC}"
            echo "   Possible causes:"
            echo "   - Invite page is unpublished"
            echo "   - Event does not exist"
            echo "   - API routing misconfigured"
        elif [ "$HTTP_CODE" == "504" ]; then
            echo -e "${RED}❌ CloudFront API endpoint returns 504 (Gateway Timeout)${NC}"
            echo "   This indicates a routing loop or backend timeout!"
        elif [ "$HTTP_CODE" == "000" ]; then
            echo -e "${YELLOW}⚠️  Could not connect to CloudFront endpoint${NC}"
        else
            echo -e "${YELLOW}⚠️  CloudFront API endpoint returns $HTTP_CODE${NC}"
        fi
    fi
    
    # Test backend directly (if ALB_DNS available)
    if [ -n "$BACKEND_API_BASE" ] && [ -n "$ALB_DNS" ]; then
        BACKEND_URL="http://${ALB_DNS}"
        echo ""
        echo "   Testing backend directly: ${BACKEND_URL}/api/events/invite/${SLUG}/"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BACKEND_URL}/api/events/invite/${SLUG}/" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" == "200" ]; then
            echo -e "${GREEN}✅ Backend API endpoint returns 200${NC}"
        elif [ "$HTTP_CODE" == "404" ]; then
            echo -e "${YELLOW}⚠️  Backend API endpoint returns 404${NC}"
            echo "   This means the invite page is unpublished or doesn't exist"
        elif [ "$HTTP_CODE" == "000" ]; then
            echo -e "${YELLOW}⚠️  Could not connect to backend (may be in private subnet)${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend API endpoint returns $HTTP_CODE${NC}"
        fi
    fi
}

# Function to check CloudFront configuration
check_cloudfront() {
    echo ""
    echo "☁️  Checking CloudFront Configuration"
    echo "-------------------------------------"
    
    DIST_ID=$(aws ssm get-parameter --name "${PARAM_PREFIX}/CLOUDFRONT_DISTRIBUTION_ID" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    
    if [ -z "$DIST_ID" ]; then
        echo -e "${YELLOW}⚠️  CloudFront Distribution ID not found in SSM${NC}"
        return 1
    fi
    
    echo "   Distribution ID: $DIST_ID"
    echo ""
    echo -e "${YELLOW}⚠️  Manual CloudFront checks required:${NC}"
    echo ""
    echo "   1. Go to CloudFront Console → Distribution → Behaviors"
    echo "   2. Verify Accept header is forwarded (CRITICAL for RSC)"
    echo "   3. Verify Rsc header is NOT forwarded"
    echo "   4. Verify /api/* paths route to backend ALB"
    echo "   5. Check origin timeout (should be 60s, not 30s)"
    echo ""
    echo "   See: CLOUDFRONT_CACHE_CONFIGURATION.md for details"
}

# Main diagnostic flow
echo "1️⃣  Checking SSM Parameters"
echo "=========================="
echo ""

BACKEND_API_BASE_OK=0
PUBLIC_API_BASE_OK=0

check_ssm_param "${PARAM_PREFIX}/BACKEND_API_BASE" "Backend API URL for SSR (should point to ALB, NOT CloudFront)"
BACKEND_API_BASE_OK=$?

echo ""
check_ssm_param "${PARAM_PREFIX}/NEXT_PUBLIC_API_BASE" "Public API base URL (used for client-side, can be CloudFront)"
PUBLIC_API_BASE_OK=$?

echo ""
check_ssm_param "${PARAM_PREFIX}/FRONTEND_URL" "Frontend/CloudFront URL"

# Check ECS environment
check_ecs_env

# Check invite page
check_invite_page

# Check API endpoints
check_api_endpoints

# Check CloudFront
check_cloudfront

# Summary
echo ""
echo "=" | awk '{printf "=%.0s", $1; for(i=1;i<=60;i++) printf "="; print ""}'
echo "📊 DIAGNOSTIC SUMMARY"
echo "=" | awk '{printf "=%.0s", $1; for(i=1;i<=60;i++) printf "="; print ""}'
echo ""

ISSUES=0

if [ $BACKEND_API_BASE_OK -ne 0 ]; then
    echo -e "${RED}❌ CRITICAL: BACKEND_API_BASE is missing or misconfigured${NC}"
    echo "   This is the #1 cause of SSR routing loops and 504 timeouts"
    echo "   Fix: Set BACKEND_API_BASE to ALB URL (http://<alb-dns>)"
    echo ""
    ISSUES=$((ISSUES + 1))
fi

echo "🔍 Next Steps:"
echo ""
echo "1. If BACKEND_API_BASE is missing, set it:"
echo "   aws ssm put-parameter \\"
echo "     --name \"${PARAM_PREFIX}/BACKEND_API_BASE\" \\"
echo "     --value \"http://<your-alb-dns>\" \\"
echo "     --type \"String\" \\"
echo "     --overwrite"
echo ""
echo "2. Check invite page status in database:"
echo "   python manage.py check_invite_page $SLUG"
echo ""
echo "3. Check CloudWatch logs for SSR errors:"
echo "   Log Group: /ecs/event-registry-staging/frontend"
echo "   Look for: [SSR API Base], [InvitePage SSR]"
echo ""
echo "4. Verify CloudFront configuration (see CLOUDFRONT_CACHE_CONFIGURATION.md)"
echo ""

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ No critical configuration issues detected${NC}"
    echo "   Check CloudWatch logs and database for invite page status"
else
    echo -e "${RED}❌ Found $ISSUES critical issue(s)${NC}"
    exit 1
fi

