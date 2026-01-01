#!/bin/bash
# Comprehensive health check for ECS services and related resources

set -e

CLUSTER_NAME="${ECS_CLUSTER_NAME:-event-registry-staging}"
REGION="${AWS_REGION:-us-east-1}"

echo "🏥 Comprehensive Service Health Check"
echo "======================================"
echo ""

# 1. Check ECS Task Status
echo "📦 ECS Task Status:"
echo "-------------------"
TASKS=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --region "$REGION" --query 'taskArns[]' --output text)

if [ -z "$TASKS" ]; then
    echo "  ⚠️  No tasks found!"
else
    for task_arn in $TASKS; do
        aws ecs describe-tasks \
            --cluster "$CLUSTER_NAME" \
            --tasks "$task_arn" \
            --region "$REGION" \
            --query 'tasks[0].[taskArn,lastStatus,healthStatus,containers[0].name,containers[0].cpu,containers[0].memory]' \
            --output text | awk '{
                split($1, arn_parts, "/")
                task_id = arn_parts[length(arn_parts)]
                print "  Task: " task_id
                print "    Status: " $2
                print "    Health: " $3
                print "    Container: " $4
                print "    CPU: " $5
                print "    Memory: " $6
            }'
        
        # Check task stop code if stopped
        STOP_CODE=$(aws ecs describe-tasks \
            --cluster "$CLUSTER_NAME" \
            --tasks "$task_arn" \
            --region "$REGION" \
            --query 'tasks[0].stopCode' \
            --output text 2>/dev/null || echo "N/A")
        
        if [ "$STOP_CODE" != "N/A" ] && [ -n "$STOP_CODE" ]; then
            echo "    ⚠️  Stop Code: $STOP_CODE"
        fi
        echo ""
    done
fi

echo ""

# 2. Check ALB Target Health
echo "🎯 ALB Target Health:"
echo "---------------------"
ALB_ARN=$(aws elbv2 describe-load-balancers --region "$REGION" \
    --query "LoadBalancers[?contains(LoadBalancerName, 'event-registry') || contains(LoadBalancerName, 'staging')].LoadBalancerArn" \
    --output text | head -1)

if [ -z "$ALB_ARN" ]; then
    echo "  ⚠️  Could not find ALB"
else
    ALB_NAME=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --region "$REGION" \
        --query 'LoadBalancers[0].LoadBalancerName' --output text)
    echo "  ALB: $ALB_NAME"
    
    TARGET_GROUPS=$(aws elbv2 describe-target-groups --load-balancer-arn "$ALB_ARN" --region "$REGION" \
        --query 'TargetGroups[].TargetGroupArn' --output text)
    
    for tg_arn in $TARGET_GROUPS; do
        TG_NAME=$(aws elbv2 describe-target-groups --target-group-arns "$tg_arn" --region "$REGION" \
            --query 'TargetGroups[0].TargetGroupName' --output text)
        echo ""
        echo "  Target Group: $TG_NAME"
        
        HEALTH=$(aws elbv2 describe-target-health --target-group-arn "$tg_arn" --region "$REGION" \
            --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
            --output text)
        
        if [ -z "$HEALTH" ]; then
            echo "    ⚠️  No targets registered"
        else
            echo "$HEALTH" | while read target_id state reason; do
                if [ "$state" = "healthy" ]; then
                    echo "    ✅ $target_id: $state"
                else
                    echo "    ❌ $target_id: $state ($reason)"
                fi
            done
        fi
    done
fi

echo ""
echo ""

# 3. Check CloudWatch Metrics (CPU/Memory)
echo "📊 Resource Utilization (Last 1 hour):"
echo "--------------------------------------"
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
START_TIME=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%S")

# Get service names
SERVICES=$(aws ecs list-services --cluster "$CLUSTER_NAME" --region "$REGION" --query 'serviceArns[]' --output text)

for service_arn in $SERVICES; do
    SERVICE_NAME=$(echo "$service_arn" | awk -F'/' '{print $NF}')
    echo ""
    echo "  Service: $SERVICE_NAME"
    
    # CPU
    CPU_DATA=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ECS \
        --metric-name CPUUtilization \
        --dimensions Name=ClusterName,Value="$CLUSTER_NAME" Name=ServiceName,Value="$SERVICE_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 300 \
        --statistics Average,Maximum \
        --region "$REGION" \
        --query 'Datapoints | sort_by(@, &Timestamp) | [-1]' \
        --output json 2>/dev/null)
    
    if [ "$CPU_DATA" != "null" ] && [ -n "$CPU_DATA" ]; then
        CPU_AVG=$(echo "$CPU_DATA" | jq -r '.Average // "N/A"')
        CPU_MAX=$(echo "$CPU_DATA" | jq -r '.Maximum // "N/A"')
        echo "    CPU: Avg=${CPU_AVG}%, Max=${CPU_MAX}%"
    else
        echo "    CPU: No data"
    fi
    
    # Memory
    MEM_DATA=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ECS \
        --metric-name MemoryUtilization \
        --dimensions Name=ClusterName,Value="$CLUSTER_NAME" Name=ServiceName,Value="$SERVICE_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 300 \
        --statistics Average,Maximum \
        --region "$REGION" \
        --query 'Datapoints | sort_by(@, &Timestamp) | [-1]' \
        --output json 2>/dev/null)
    
    if [ "$MEM_DATA" != "null" ] && [ -n "$MEM_DATA" ]; then
        MEM_AVG=$(echo "$MEM_DATA" | jq -r '.Average // "N/A"')
        MEM_MAX=$(echo "$MEM_DATA" | jq -r '.Maximum // "N/A"')
        echo "    Memory: Avg=${MEM_AVG}%, Max=${MEM_MAX}%"
    else
        echo "    Memory: No data"
    fi
done

echo ""
echo ""

# 4. Check for errors in logs (last 30 minutes)
echo "📋 Recent Errors in Logs (Last 30 minutes):"
echo "-------------------------------------------"
LOG_GROUP="/ecs/$CLUSTER_NAME/backend"
START_TIME_MS=$(($(date +%s) - 1800))000

if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" \
    --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q .; then
    
    ERROR_COUNT=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$START_TIME_MS" \
        --filter-pattern "ERROR" \
        --region "$REGION" \
        --query 'events | length(@)' \
        --output text 2>/dev/null || echo "0")
    
    echo "  Backend Errors: $ERROR_COUNT"
    
    if [ "$ERROR_COUNT" != "0" ] && [ "$ERROR_COUNT" != "" ]; then
        echo "  Recent error messages:"
        aws logs filter-log-events \
            --log-group-name "$LOG_GROUP" \
            --start-time "$START_TIME_MS" \
            --filter-pattern "ERROR" \
            --region "$REGION" \
            --query 'events[-5:].message' \
            --output text 2>/dev/null | head -5 | while read line; do
                echo "    - $line"
            done
    fi
else
    echo "  ⚠️  Log group not found: $LOG_GROUP"
fi

echo ""
echo ""

# 5. Check RDS Database Status
echo "🗄️  RDS Database Status:"
echo "------------------------"
DB_INSTANCE=$(aws rds describe-db-instances --region "$REGION" \
    --query "DBInstances[?contains(DBInstanceIdentifier, 'event-registry') || contains(DBInstanceIdentifier, 'staging')].DBInstanceIdentifier" \
    --output text | head -1)

if [ -n "$DB_INSTANCE" ]; then
    DB_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_INSTANCE" \
        --region "$REGION" \
        --query 'DBInstances[0].[DBInstanceStatus,DBInstanceClass,Endpoint.Address]' \
        --output text)
    
    echo "$DB_STATUS" | awk '{
        print "  Instance: '$DB_INSTANCE'"
        print "  Status: " $1
        print "  Class: " $2
        print "  Endpoint: " $3
    }'
    
    # Check connection count (if available)
    echo ""
    echo "  💡 To check active connections, run:"
    echo "     psql -h <endpoint> -U postgres -c \"SELECT count(*) FROM pg_stat_activity;\""
else
    echo "  ⚠️  Could not find RDS instance"
fi

echo ""
echo ""
echo "✅ Health check complete!"
echo ""
echo "💡 Common Issues:"
echo "   - High CPU/Memory: Consider increasing task CPU/memory"
echo "   - Unhealthy targets: Check application logs and health check configuration"
echo "   - Database issues: Check RDS performance insights and connection pooling"

