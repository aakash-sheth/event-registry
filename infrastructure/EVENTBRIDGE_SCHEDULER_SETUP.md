# AWS EventBridge Scheduler Setup for Analytics Batch Processing

## Overview

This setup uses **AWS EventBridge** (formerly CloudWatch Events) to automatically trigger analytics batch processing. This is the **most reliable approach** because:

✅ **99.99% uptime SLA** - AWS managed service  
✅ **Independent of application** - Works even if app is down temporarily  
✅ **Easy to monitor** - CloudWatch integration  
✅ **Automatic retries** - Built-in error handling  
✅ **No code dependencies** - Doesn't rely on background_task library state  
✅ **Cost-effective** - First 1 million requests/month are free  

## Quick Setup

```bash
cd infrastructure
chmod +x setup-analytics-scheduler.sh
./setup-analytics-scheduler.sh
```

## What It Does

1. **Creates IAM Role**: Allows EventBridge to run ECS tasks
2. **Creates EventBridge Rule**: Schedules task execution every N minutes (default: 30)
3. **Creates Target**: Configures ECS task to run `process_analytics_batch` command
4. **Enables Rule**: Activates the scheduler

## Configuration

### Environment Variables

Before running the setup script, you can customize:

```bash
export ANALYTICS_BATCH_INTERVAL_MINUTES=30  # Default: 30 minutes
./setup-analytics-scheduler.sh
```

### Update Network Configuration

Edit `setup-analytics-scheduler.sh` and update:
- `SUBNET_1` and `SUBNET_2`: Your private subnet IDs
- `SG_ID`: Your backend security group ID
- `CLUSTER_NAME`: Your ECS cluster name
- `TASK_DEF`: Your task definition name

## How It Works

```
EventBridge Rule (every 30 min)
    ↓
Triggers ECS RunTask
    ↓
Runs: python manage.py process_analytics_batch
    ↓
Processes analytics cache → Database
```

## Monitoring

### View Rule Status

```bash
aws events describe-rule --name analytics-batch-processor --region us-east-1
```

### View Recent Executions

```bash
# Check CloudWatch Logs
aws logs tail /ecs/event-registry-staging/backend --since 1h --format short | grep -i "batch\|analytics"
```

### View in Django Admin

Navigate to: `/api/admin/analytics-batch/`

Shows:
- Recent batch runs
- Processing statistics
- Success/failure status

## Manual Testing

### Test the Rule Manually

Run the batch processing command directly:

```bash
aws ecs run-task \
  --cluster event-registry-staging \
  --task-definition backend-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-047b6a50234127a66,subnet-043a1224e8eb0640d],securityGroups=[sg-02c8a03bf690d592f],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["python","manage.py","process_analytics_batch"]}]}'
```

## Management Commands

### Disable Scheduler

```bash
aws events disable-rule --name analytics-batch-processor --region us-east-1
```

### Enable Scheduler

```bash
aws events enable-rule --name analytics-batch-processor --region us-east-1
```

### Update Schedule Interval

Edit the script and change `BATCH_INTERVAL_MINUTES`, then re-run:

```bash
export ANALYTICS_BATCH_INTERVAL_MINUTES=15  # Change to 15 minutes
./setup-analytics-scheduler.sh
```

### Delete Scheduler

```bash
# Remove target
aws events remove-targets \
  --rule analytics-batch-processor \
  --ids analytics-batch-ecs-task \
  --region us-east-1

# Delete rule
aws events delete-rule --name analytics-batch-processor --region us-east-1
```

## Troubleshooting

### Rule Not Triggering

1. **Check rule status:**
   ```bash
   aws events describe-rule --name analytics-batch-processor --region us-east-1
   ```
   Should show `"State": "ENABLED"`

2. **Check IAM permissions:**
   ```bash
   aws iam get-role-policy \
     --role-name EventBridge-ECSRunTask-Role \
     --policy-name EventBridge-ECSRunTask-Policy
   ```

3. **Check CloudWatch Logs for errors:**
   ```bash
   aws logs tail /ecs/event-registry-staging/backend --since 1h | grep -i error
   ```

### Tasks Failing

1. **Check task execution logs:**
   ```bash
   aws logs tail /ecs/event-registry-staging/backend --since 1h
   ```

2. **Verify task definition exists:**
   ```bash
   aws ecs describe-task-definition --task-definition backend-task
   ```

3. **Test manually:**
   Run the manual test command above to see detailed error messages

## Cost

- **EventBridge**: First 1 million requests/month are **FREE**
- **ECS Tasks**: Pay only for task execution time (typically < 1 minute per run)
- **Estimated cost**: ~$0.01-0.05/month for 30-minute intervals

## Comparison with Other Approaches

| Approach | Reliability | Complexity | Cost | Recommendation |
|----------|------------|------------|------|----------------|
| **EventBridge** | ⭐⭐⭐⭐⭐ | Low | Very Low | ✅ **Best** |
| Worker Service | ⭐⭐⭐ | Medium | Low | Good for complex tasks |
| Cron Job | ⭐⭐ | High | Low | Not recommended for ECS |

## Next Steps

After setup:
1. ✅ Verify rule is enabled
2. ✅ Wait for first execution (check logs)
3. ✅ Monitor in Django admin
4. ✅ Set up CloudWatch alarms if needed
