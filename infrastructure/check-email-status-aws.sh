#!/bin/bash

# Script to check email sending status for a specific email on AWS ECS
# Usage: ./check-email-status-aws.sh <email> [--hours N]

set -e

# Configuration
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"

# Parse arguments
EMAIL=""
HOURS=24

if [ $# -eq 0 ]; then
    echo "Usage: $0 <email> [--hours N]"
    echo "Example: $0 aakashsheth65@gmail.com --hours 48"
    exit 1
fi

EMAIL="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        --hours)
            HOURS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$EMAIL" ]; then
    echo "Error: Email address is required"
    exit 1
fi

echo "🔍 Checking email status for: $EMAIL"
echo "Looking back: $HOURS hours"
echo ""

# Build command JSON
CMD_JSON="[\"python\", \"manage.py\", \"check_email_status\", \"$EMAIL\", \"--hours\", \"$HOURS\"]"

# Build environment variables (empty for now, but can add if needed)
ENV_VARS="[]"

echo "Starting ECS task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --overrides "{
    \"containerOverrides\": [{
      \"name\": \"backend\",
      \"command\": $CMD_JSON,
      \"environment\": $ENV_VARS
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
echo "Waiting for task to complete..."
echo "(This may take 30-60 seconds)"
echo ""

# Wait for task to complete
MAX_WAIT=120
WAIT_TIME=0
while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    TASK_STATUS=$(aws ecs describe-tasks \
      --cluster "$CLUSTER_NAME" \
      --tasks "$TASK_ARN" \
      --query 'tasks[0].lastStatus' \
      --output text)
    
    if [ "$TASK_STATUS" = "STOPPED" ]; then
        break
    fi
    
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
    echo -n "."
done

echo ""
echo ""

# Get task exit code
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

if [ "$EXIT_CODE" != "0" ] && [ "$EXIT_CODE" != "None" ]; then
    echo "⚠️  Task exited with code: $EXIT_CODE"
    echo ""
fi

# Get logs
echo "📋 Task Output:"
echo "=" * 60
aws logs tail "/ecs/$CLUSTER_NAME/backend" \
  --since 5m \
  --format short \
  --filter-pattern "$TASK_ARN" 2>/dev/null || \
aws logs tail "/ecs/$CLUSTER_NAME/backend" \
  --since 5m \
  --format short | tail -50

echo ""
echo "=" * 60
echo "✅ Diagnostic complete"
echo ""
echo "To see full logs, run:"
echo "  aws logs tail /ecs/$CLUSTER_NAME/backend --since 10m --format short"
