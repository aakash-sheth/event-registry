#!/bin/bash
# Diagnostic script for ECS service stabilization issues

set -e

CLUSTER_NAME="${1:-event-registry-staging}"
SERVICE_NAME="${2:-backend-service}"
REGION="${3:-us-east-1}"

echo "🔍 Diagnosing ECS Service: $SERVICE_NAME in cluster: $CLUSTER_NAME"
echo "=========================================="
echo ""

# 1. Service Status
echo "=== 1. Service Status ==="
aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$REGION" \
  --query 'services[0].{Desired:desiredCount,Running:runningCount,Pending:pendingCount,Deployments:deployments[*].{Status:status,Running:runningCount,Desired:desiredCount,Id:id,CreatedAt:createdAt}}' \
  --output json | jq .
echo ""

# 2. Service Events (most recent)
echo "=== 2. Recent Service Events (last 10) ==="
aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$REGION" \
  --query 'services[0].events[:10]' \
  --output table
echo ""

# 3. Running Tasks
echo "=== 3. Running Tasks ==="
RUNNING_TASKS=$(aws ecs list-tasks \
  --cluster "$CLUSTER_NAME" \
  --service-name "$SERVICE_NAME" \
  --desired-status RUNNING \
  --region "$REGION" \
  --query 'taskArns[]' \
  --output text)

if [ -n "$RUNNING_TASKS" ]; then
  for TASK in $RUNNING_TASKS; do
    echo "--- Task: $(basename $TASK) ---"
    aws ecs describe-tasks \
      --cluster "$CLUSTER_NAME" \
      --tasks "$TASK" \
      --region "$REGION" \
      --query 'tasks[0].{LastStatus:lastStatus,DesiredStatus:desiredStatus,HealthStatus:healthStatus,Containers:containers[*].{Name:name,LastStatus:lastStatus,HealthStatus:healthStatus,ExitCode:exitCode,Reason:reason}}' \
      --output json | jq .
    echo ""
  done
else
  echo "No running tasks found"
  echo ""
fi

# 4. Stopped Tasks (recent failures)
echo "=== 4. Recently Stopped Tasks (last 5) ==="
STOPPED_TASKS=$(aws ecs list-tasks \
  --cluster "$CLUSTER_NAME" \
  --service-name "$SERVICE_NAME" \
  --desired-status STOPPED \
  --region "$REGION" \
  --max-items 5 \
  --query 'taskArns[]' \
  --output text)

if [ -n "$STOPPED_TASKS" ]; then
  for TASK in $STOPPED_TASKS; do
    echo "--- Stopped Task: $(basename $TASK) ---"
    TASK_INFO=$(aws ecs describe-tasks \
      --cluster "$CLUSTER_NAME" \
      --tasks "$TASK" \
      --region "$REGION" \
      --query 'tasks[0].{LastStatus:lastStatus,StoppedReason:stoppedReason,StoppedAt:stoppedAt,Containers:containers[*].{Name:name,ExitCode:exitCode,Reason:reason}}' \
      --output json)
    echo "$TASK_INFO" | jq .
    
    # Extract stopped reason
    STOPPED_REASON=$(echo "$TASK_INFO" | jq -r '.StoppedReason // "N/A"')
    echo "Stopped Reason: $STOPPED_REASON"
    echo ""
  done
else
  echo "No stopped tasks found"
  echo ""
fi

# 5. Task Definition
echo "=== 5. Current Task Definition ==="
TASK_DEF=$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text)

echo "Task Definition: $TASK_DEF"
echo ""

# Get task definition details
TASK_DEF_FAMILY=$(echo "$TASK_DEF" | cut -d'/' -f2 | cut -d':' -f1)
TASK_DEF_REVISION=$(echo "$TASK_DEF" | cut -d':' -f2)

aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region "$REGION" \
  --query 'taskDefinition.{Family:family,Revision:revision,Status:status,CPU:cpu,Memory:memory,ContainerDefinitions:containerDefinitions[*].{Name:name,Image:image,HealthCheck:healthCheck}}' \
  --output json | jq .
echo ""

# 6. CloudWatch Logs (if available)
echo "=== 6. Recent CloudWatch Logs (last 20 lines) ==="
LOG_GROUP="/ecs/$CLUSTER_NAME/backend"
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "$LOG_GROUP"; then
  echo "Fetching logs from: $LOG_GROUP"
  aws logs tail "$LOG_GROUP" --region "$REGION" --since 10m --format short 2>/dev/null | tail -20 || echo "No recent logs found"
else
  echo "Log group not found: $LOG_GROUP"
fi
echo ""

# 7. Health Check Analysis
echo "=== 7. Health Check Analysis ==="
echo "Checking if health endpoint is accessible from within container..."
echo "Health check command in task definition: curl -f http://localhost:8000/api/health"
echo ""
echo "Common issues:"
echo "  - Health check failing: Check if /api/health endpoint exists and returns 200"
echo "  - Database connection: Health check returns 503 if database is unavailable"
echo "  - Container not starting: Check CloudWatch logs for startup errors"
echo "  - Missing dependencies: Check if curl is installed in Docker image"
echo ""

# 8. Recommendations
echo "=== 8. Recommendations ==="
if [ -n "$STOPPED_TASKS" ]; then
  echo "⚠️  Found stopped tasks. Common causes:"
  echo "   1. Application crash on startup"
  echo "   2. Database connection failure"
  echo "   3. Missing environment variables"
  echo "   4. Health check failures"
  echo ""
  echo "   Check CloudWatch logs:"
  echo "   aws logs tail $LOG_GROUP --follow --region $REGION"
fi

echo ""
echo "To view real-time logs:"
echo "  aws logs tail $LOG_GROUP --follow --region $REGION"
echo ""
echo "To check service events:"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION --query 'services[0].events[:10]' --output table"
echo ""

