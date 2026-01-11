#!/bin/bash

# Script to create a superuser on AWS ECS
# Usage: ./create-superuser-aws.sh <email> <password> [name]

set -e

# Configuration
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"

# Get arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <email> <password> [name]"
    echo ""
    echo "Example:"
    echo "  $0 admin@example.com SecurePass123! \"Admin User\""
    exit 1
fi

EMAIL="$1"
PASSWORD="$2"
NAME="${3:-Admin User}"

echo "🚀 Creating superuser on AWS ECS..."
echo "   Email: $EMAIL"
echo "   Name: $NAME"
echo ""

# Run the ECS task
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --overrides "{
    \"containerOverrides\": [{
      \"name\": \"backend\",
      \"command\": [\"python\", \"manage.py\", \"create_superuser_noninteractive\"],
      \"environment\": [
        {\"name\": \"DJANGO_SUPERUSER_EMAIL\", \"value\": \"$EMAIL\"},
        {\"name\": \"DJANGO_SUPERUSER_PASSWORD\", \"value\": \"$PASSWORD\"},
        {\"name\": \"DJANGO_SUPERUSER_NAME\", \"value\": \"$NAME\"}
      ]
    }]
  }" \
  --query 'tasks[0].taskArn' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
    echo "❌ Failed to start task"
    exit 1
fi

echo "✅ Task started: $TASK_ARN"
echo ""
echo "⏳ Waiting for task to complete..."
echo "   (This may take 1-2 minutes)"
echo ""

# Wait for task to complete
aws ecs wait tasks-stopped \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" || true

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
    echo "✅ Superuser created successfully!"
    echo ""
    echo "📋 View logs:"
    echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --follow"
else
    echo "❌ Task failed (exit code: $EXIT_CODE)"
    if [ -n "$STOPPED_REASON" ] && [ "$STOPPED_REASON" != "None" ]; then
        echo "   Reason: $STOPPED_REASON"
    fi
    echo ""
    echo "📋 Check logs:"
    echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --follow"
    exit 1
fi



