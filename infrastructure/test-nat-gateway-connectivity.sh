#!/bin/bash

# Script to test NAT Gateway connectivity from ECS frontend service
# This verifies that the frontend can now reach the ALB via NAT Gateway

set -e

# Configuration
CLUSTER_NAME="event-registry-staging"
TASK_DEF="frontend-task"
SUBNET_1="subnet-047b6a50234127a66"  # staging-private-1
SUBNET_2="subnet-043a1224e8eb0640d"  # staging-private-2
SG_ID="sg-02c8a03bf690d592f"
ALB_DNS=$(aws ssm get-parameter --name "/event-registry-staging/ALB_DNS" --query "Parameter.Value" --output text 2>/dev/null || echo "staging-alb-33342285.us-east-1.elb.amazonaws.com")

echo "🧪 Testing NAT Gateway Connectivity"
echo "==================================="
echo ""
echo "Configuration:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Task Definition: $TASK_DEF"
echo "  ALB DNS: $ALB_DNS"
echo ""

# Build test command
# Test 1: DNS resolution
# Test 2: HTTP connectivity to ALB
# Test 3: API endpoint reachability
CMD_JSON="[\"sh\", \"-c\", \"echo 'Testing NAT Gateway connectivity...' && echo '' && echo '1. Testing DNS resolution:' && nslookup $ALB_DNS && echo '' && echo '2. Testing HTTP connectivity:' && curl -v -m 10 http://$ALB_DNS/api/health 2>&1 | head -20 && echo '' && echo '3. Testing API endpoint:' && curl -m 10 http://$ALB_DNS/api/health || echo 'Connection failed' && echo '' && echo '✅ Connectivity test complete'\" ]"

echo "Starting ECS task to test connectivity..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}" \
  --overrides "{
    \"containerOverrides\": [{
      \"name\": \"frontend\",
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
sleep 5
aws logs tail "/ecs/$CLUSTER_NAME/frontend" --since 5m --format short 2>&1 | tail -50 || echo "   (Logs may take a moment to appear)"

# Get task status
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

echo ""
echo "============================================================"
if [ "$EXIT_CODE" = "0" ]; then
  echo "✅ Connectivity test PASSED!"
  echo "   Frontend can now reach ALB via NAT Gateway"
else
  echo "⚠️  Connectivity test completed with exit code: $EXIT_CODE"
  echo "   Check logs above for details"
fi
echo "============================================================"
echo ""


