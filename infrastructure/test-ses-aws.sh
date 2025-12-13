#!/bin/bash

# Script to test AWS SES email sending on AWS ECS
# Usage: ./test-ses-aws.sh <to-email> [from-email] [--check-config] [--check-logs]

set -e

# Configuration
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"

# Parse arguments
TO_EMAIL=""
FROM_EMAIL=""
CHECK_CONFIG=false
CHECK_LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-config)
            CHECK_CONFIG=true
            shift
            ;;
        --check-logs)
            CHECK_LOGS=true
            shift
            ;;
        --from)
            FROM_EMAIL="$2"
            shift 2
            ;;
        *)
            if [ -z "$TO_EMAIL" ]; then
                TO_EMAIL="$1"
            else
                echo "Unknown option: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [ "$CHECK_CONFIG" = false ] && [ "$CHECK_LOGS" = false ] && [ -z "$TO_EMAIL" ]; then
    echo "Usage: $0 <to-email> [--from <from-email>] [--check-config] [--check-logs]"
    echo ""
    echo "Examples:"
    echo "  $0 test@example.com"
    echo "  $0 test@example.com --from custom@ekfern.com"
    echo "  $0 --check-config"
    echo "  $0 --check-logs"
    exit 1
fi

echo "📧 Testing AWS SES email configuration on ECS..."
if [ -n "$TO_EMAIL" ]; then
    echo "   To: $TO_EMAIL"
fi
if [ -n "$FROM_EMAIL" ]; then
    echo "   From: $FROM_EMAIL"
fi
if [ "$CHECK_CONFIG" = true ]; then
    echo "   Mode: Configuration check only"
fi
if [ "$CHECK_LOGS" = true ]; then
    echo "   Mode: Log check only"
fi
echo ""

# Build command JSON
if [ "$CHECK_CONFIG" = true ]; then
    CMD_JSON='["python", "manage.py", "test_ses_email", "--check-config"]'
elif [ "$CHECK_LOGS" = true ]; then
    CMD_JSON='["python", "manage.py", "test_ses_email", "--check-logs"]'
else
    if [ -n "$FROM_EMAIL" ]; then
        CMD_JSON="[\"python\", \"manage.py\", \"test_ses_email\", \"--to\", \"$TO_EMAIL\", \"--from\", \"$FROM_EMAIL\"]"
    else
        CMD_JSON="[\"python\", \"manage.py\", \"test_ses_email\", \"--to\", \"$TO_EMAIL\"]"
    fi
fi

# Build environment variables
ENV_VARS="[]"
if [ -n "$FROM_EMAIL" ]; then
    ENV_VARS="[{\"name\": \"SES_FROM_EMAIL\", \"value\": \"$FROM_EMAIL\"}]"
fi

# Run the ECS task
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
    echo "✅ Test completed successfully!"
    if [ -n "$TO_EMAIL" ] && [ "$CHECK_CONFIG" = false ] && [ "$CHECK_LOGS" = false ]; then
        echo ""
        echo "📬 Check the inbox for: $TO_EMAIL"
        echo "   If you received the email, SES is working correctly!"
    fi
    echo ""
    echo "📋 View full logs:"
    echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --follow"
else
    echo "❌ Test failed (exit code: $EXIT_CODE)"
    if [ -n "$STOPPED_REASON" ] && [ "$STOPPED_REASON" != "None" ]; then
        echo "   Reason: $STOPPED_REASON"
    fi
    echo ""
    echo "📋 Check logs for details:"
    echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --follow"
    exit 1
fi
