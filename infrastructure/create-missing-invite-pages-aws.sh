#!/bin/bash

# Script to create InvitePage records for all events that don't have one on AWS ECS
# Usage: ./create-missing-invite-pages-aws.sh [--dry-run] [--publish-existing]

set -e

# Configuration
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"

# Parse arguments
DRY_RUN=false
PUBLISH_EXISTING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --publish-existing)
            PUBLISH_EXISTING=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo ""
            echo "Usage: $0 [--dry-run] [--publish-existing]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Show what would be created without actually creating records"
            echo "  --publish-existing  Mark InvitePage as published if event already has page_config"
            echo ""
            echo "Examples:"
            echo "  $0 --dry-run                    # Preview what would be created"
            echo "  $0                              # Create all missing InvitePage records (as drafts)"
            echo "  $0 --publish-existing           # Create and publish events that have page_config"
            exit 1
            ;;
    esac
done

echo "🚀 Creating missing InvitePage records on AWS ECS..."
if [ "$DRY_RUN" = true ]; then
    echo "   Mode: DRY RUN (no changes will be made)"
fi
if [ "$PUBLISH_EXISTING" = true ]; then
    echo "   Mode: Will publish events that already have page_config"
fi
echo ""

# Build command array
CMD_ARRAY=("python" "manage.py" "create_missing_invite_pages")
if [ "$DRY_RUN" = true ]; then
    CMD_ARRAY+=("--dry-run")
fi
if [ "$PUBLISH_EXISTING" = true ]; then
    CMD_ARRAY+=("--publish-existing")
fi

# Convert to JSON array format
CMD_JSON="["
for i in "${!CMD_ARRAY[@]}"; do
    if [ $i -gt 0 ]; then
        CMD_JSON+=", "
    fi
    CMD_JSON+="\"${CMD_ARRAY[$i]}\""
done
CMD_JSON+="]"

echo "📋 Command: ${CMD_ARRAY[*]}"
echo ""

# Run the ECS task
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
echo "   (This may take 1-3 minutes depending on number of events)"
echo ""

# Wait for task to complete
aws ecs wait tasks-stopped \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" || true

# Get task logs
echo ""
echo "📋 Task Logs:"
echo "============================================================"
# Wait a bit for logs to appear in CloudWatch
sleep 10
aws logs tail "/ecs/$CLUSTER_NAME/backend" --since 10m --format short 2>&1 | grep -A 200 "Creating missing\|Created\|Skipped\|SUMMARY\|Migration complete" || echo "   (Logs may take a moment to appear - check CloudWatch logs manually)"
echo ""

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
    echo "✅ Migration completed successfully!"
    echo ""
    if [ "$DRY_RUN" = true ]; then
        echo "⚠️  This was a dry run. Run without --dry-run to create InvitePage records."
    else
        echo "✅ All missing InvitePage records have been created."
    fi
else
    echo "❌ Task failed (exit code: $EXIT_CODE)"
    if [ -n "$STOPPED_REASON" ] && [ "$STOPPED_REASON" != "None" ]; then
        echo "   Reason: $STOPPED_REASON"
    fi
    echo ""
    echo "📋 Check full logs:"
    echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --since 10m --format short"
    exit 1
fi

echo ""
echo "📋 View full logs:"
echo "   aws logs tail /ecs/$CLUSTER_NAME/backend --since 10m --format short"

