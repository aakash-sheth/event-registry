#!/bin/bash
# Run performance analysis on production ECS instance
# This uses the Django management command we created

set -e

PARAM_PREFIX="/event-registry-staging"
CLUSTER_NAME="event-registry-staging"
SERVICE_NAME="backend-service"
SLUG="${1:-envolope-test1}"

echo "🔍 Running Performance Analysis on Production"
echo "============================================="
echo ""

# Get running task
echo "📋 Getting running task..."
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --service-name "$SERVICE_NAME" --desired-status RUNNING --query "taskArns[0]" --output text)

if [ -z "$TASK_ARN" ]; then
    echo "❌ No running tasks found for service"
    exit 1
fi

echo "✅ Found task: $TASK_ARN"
echo ""

# Get network configuration from service
echo "📋 Getting network configuration..."
SERVICE_DETAILS=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query "services[0]" --output json)
SUBNET_IDS=$(echo "$SERVICE_DETAILS" | jq -r '.networkConfiguration.awsvpcConfiguration.subnets[]' | tr '\n' ',' | sed 's/,$//')
SECURITY_GROUPS=$(echo "$SERVICE_DETAILS" | jq -r '.networkConfiguration.awsvpcConfiguration.securityGroups[]' | tr '\n' ',' | sed 's/,$//')

if [ -z "$SUBNET_IDS" ] || [ -z "$SECURITY_GROUPS" ]; then
    echo "❌ Could not get network configuration"
    exit 1
fi

echo "   Subnets: $SUBNET_IDS"
echo "   Security Groups: $SECURITY_GROUPS"
echo ""

# Build command JSON
CMD_JSON="[\"python\", \"manage.py\", \"analyze_invite_performance\", \"$SLUG\"]"

echo "🚀 Running analysis command..."
echo "   Command: python manage.py analyze_invite_performance $SLUG"
echo ""

# Run the command
TASK_OUTPUT=$(aws ecs run-task \
    --cluster "$CLUSTER_NAME" \
    --task-definition backend-task \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=DISABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":$CMD_JSON}]}" \
    --query "tasks[0].{taskArn:taskArn,lastStatus:lastStatus}" \
    --output json)

TASK_ARN_NEW=$(echo "$TASK_OUTPUT" | jq -r '.taskArn')
TASK_STATUS=$(echo "$TASK_OUTPUT" | jq -r '.lastStatus')

echo "✅ Task started: $TASK_ARN_NEW"
echo "   Status: $TASK_STATUS"
echo ""

# Extract task ID for log group
TASK_ID=$(echo "$TASK_ARN_NEW" | awk -F'/' '{print $NF}')

echo "📋 Waiting for task to complete (checking every 5 seconds)..."
echo "   Task ID: $TASK_ID"
echo ""

# Wait for task to complete (max 2 minutes)
MAX_WAIT=120
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    
    TASK_INFO=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN_NEW" --query "tasks[0].{status:lastStatus,stopCode:stopCode,exitCode:containers[0].exitCode}" --output json 2>/dev/null || echo '{"status":"UNKNOWN"}')
    STATUS=$(echo "$TASK_INFO" | jq -r '.status')
    
    if [ "$STATUS" = "STOPPED" ]; then
        EXIT_CODE=$(echo "$TASK_INFO" | jq -r '.exitCode // 1')
        if [ "$EXIT_CODE" = "0" ]; then
            echo "✅ Task completed successfully"
        else
            echo "⚠️  Task completed with exit code: $EXIT_CODE"
        fi
        break
    fi
    
    echo "   Waiting... ($ELAPSED/$MAX_WAIT seconds) - Status: $STATUS"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "⏳ Timeout reached. Task may still be running."
fi

echo ""
echo "📋 Task Logs:"
echo "============================================================"
# Wait a bit for logs to appear
sleep 5
aws logs tail "/ecs/$CLUSTER_NAME/backend" --since 5m --format short 2>&1 | grep -A 200 "DATABASE PERFORMANCE\|CHECKING INDEXES\|TABLE SIZES\|ROW COUNTS\|QUERY PERFORMANCE\|RECOMMENDATIONS" || echo "   (Logs may take a moment to appear - check CloudWatch logs manually)"
echo ""
echo "💡 To see full logs:"
echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --since 10m --format short | grep -A 500 'DATABASE PERFORMANCE'"

