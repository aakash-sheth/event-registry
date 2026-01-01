#!/bin/bash

# Script to check invite page status on AWS ECS
# Usage: ./check-invite-page-aws.sh <slug>

set -e

# Configuration
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"

# Get arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <slug>"
    echo ""
    echo "Example:"
    echo "  $0 envolope-test1"
    exit 1
fi

SLUG="$1"

echo "🔍 Checking invite page for slug: $SLUG"
echo ""

# Build command JSON using Django management command
CMD_JSON="[\"python\", \"manage.py\", \"check_invite_page\", \"$SLUG\"]"

echo "Starting ECS task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --overrides "{
    \"containerOverrides\": [{
      \"name\": \"backend\",
      \"command\": $CMD_JSON
    }]
  }" \
  --query 'tasks[0].taskArn' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
    echo "❌ Failed to start ECS task"
    exit 1
fi

echo "✅ Task started: $TASK_ARN"
echo ""
echo "⏳ Waiting for task to complete..."
echo "   (This may take 30-60 seconds)"
echo ""

# Wait for task to complete
aws ecs wait tasks-stopped \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" || true

# Get task logs
echo ""
echo "📋 Task Logs:"
echo "============================================================"
# Wait a bit for logs to appear
sleep 5
aws logs tail "/ecs/$CLUSTER_NAME/backend" --since 5m --format short 2>&1 | grep -A 100 "Checking event\|Event found\|InvitePage\|ISSUE" || echo "   (Logs may take a moment to appear - check CloudWatch logs manually)"

# Get task status
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

STOPPED_REASON=$(aws ecs describe-tasks \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].stoppedReason' \
  --output text)

echo ""
if [ "$EXIT_CODE" = "0" ]; then
    echo "✅ Investigation completed!"
else
    echo "⚠️  Task exited with code: $EXIT_CODE"
    echo "   Reason: $STOPPED_REASON"
fi


