#!/bin/bash
# Check if AWS budget actions are affecting ECS services

set -e

CLUSTER_NAME="${ECS_CLUSTER_NAME:-event-registry-staging}"
REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Checking for budget-related issues..."
echo ""

# 1. Check ECS service status and task counts
echo "📊 ECS Service Status:"
echo "======================"
aws ecs list-services --cluster "$CLUSTER_NAME" --region "$REGION" --query 'serviceArns[]' --output text | while read service_arn; do
    service_name=$(echo "$service_arn" | awk -F'/' '{print $NF}')
    echo ""
    echo "Service: $service_name"
    aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$service_name" \
        --region "$REGION" \
        --query 'services[0].[desiredCount,runningCount,pendingCount,status]' \
        --output table \
        --output text | awk '{print "  Desired: "$1", Running: "$2", Pending: "$3", Status: "$4}'
    
    # Check for recent service events
    echo "  Recent Events:"
    aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$service_name" \
        --region "$REGION" \
        --query 'services[0].events[0:3].[createdAt,message]' \
        --output text | head -3 | while read timestamp message; do
            echo "    [$timestamp] $message"
        done
done

echo ""
echo ""

# 2. Check for budget actions (requires AWS CLI with budgets permissions)
echo "💰 Budget Actions Check:"
echo "========================"
echo "Note: This requires AWS Budgets permissions. If you don't have access, check AWS Console."
echo ""

# List budgets and check for actions
BUDGETS=$(aws budgets describe-budgets --account-id $(aws sts get-caller-identity --query Account --output text) --region us-east-1 2>/dev/null || echo "")

if [ -z "$BUDGETS" ] || [ "$BUDGETS" == "[]" ]; then
    echo "  ⚠️  No budgets found or no access to budgets API"
    echo "  Check AWS Console: https://console.aws.amazon.com/billing/home#/budgets"
else
    echo "$BUDGETS" | jq -r '.Budgets[] | "Budget: \(.BudgetName) - Actions: \(.ActionsSubscribers | length)"' 2>/dev/null || echo "  Could not parse budget data"
fi

echo ""
echo ""

# 3. Check CloudWatch metrics for service health
echo "📈 CloudWatch Metrics (Last 1 hour):"
echo "===================================="
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
START_TIME=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%S")

# Check CPU utilization
echo "CPU Utilization:"
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name CPUUtilization \
    --dimensions Name=ClusterName,Value="$CLUSTER_NAME" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 300 \
    --statistics Average,Maximum \
    --region "$REGION" \
    --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
    --output table 2>/dev/null || echo "  Could not fetch CPU metrics"

echo ""
echo "Memory Utilization:"
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name MemoryUtilization \
    --dimensions Name=ClusterName,Value="$CLUSTER_NAME" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 300 \
    --statistics Average,Maximum \
    --region "$REGION" \
    --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
    --output table 2>/dev/null || echo "  Could not fetch Memory metrics"

echo ""
echo ""

# 4. Check ALB target health
echo "🏥 ALB Target Health:"
echo "===================="
# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --region "$REGION" --query "LoadBalancers[?contains(LoadBalancerName, 'event-registry') || contains(LoadBalancerName, 'staging')].LoadBalancerArn" --output text | head -1)

if [ -n "$ALB_ARN" ]; then
    TARGET_GROUPS=$(aws elbv2 describe-target-groups --load-balancer-arn "$ALB_ARN" --region "$REGION" --query 'TargetGroups[].TargetGroupArn' --output text)
    
    for tg_arn in $TARGET_GROUPS; do
        tg_name=$(aws elbv2 describe-target-groups --target-group-arns "$tg_arn" --region "$REGION" --query 'TargetGroups[0].TargetGroupName' --output text)
        echo "Target Group: $tg_name"
        aws elbv2 describe-target-health \
            --target-group-arn "$tg_arn" \
            --region "$REGION" \
            --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
            --output table
        echo ""
    done
else
    echo "  ⚠️  Could not find ALB"
fi

echo ""
echo ""

# 5. Check for throttling or rate limiting
echo "🚦 Throttling Check:"
echo "==================="
echo "Checking CloudWatch logs for throttling errors in the last hour..."

LOG_GROUP="/ecs/$CLUSTER_NAME/backend"
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q .; then
    START_TIME_MS=$(($(date +%s) - 3600))000
    aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$START_TIME_MS" \
        --filter-pattern "Throttling OR throttled OR rate limit OR 429" \
        --region "$REGION" \
        --query 'events[*].message' \
        --output text 2>/dev/null | head -5 || echo "  No throttling errors found in logs"
else
    echo "  ⚠️  Log group not found: $LOG_GROUP"
fi

echo ""
echo ""
echo "✅ Check complete!"
echo ""
echo "💡 If services are scaled down or stopped:"
echo "   1. Check AWS Budgets Console for any active actions"
echo "   2. Check if budget threshold was exceeded"
echo "   3. Scale services back up if needed:"
echo "      aws ecs update-service --cluster $CLUSTER_NAME --service backend-service --desired-count 1"
echo "      aws ecs update-service --cluster $CLUSTER_NAME --service frontend-service --desired-count 1"

