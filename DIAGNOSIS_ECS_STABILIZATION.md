# ECS Service Stabilization Diagnosis

## Potential Issues Identified

### 1. **Health Check Configuration** ✅
- **Status**: Configured correctly
- **Health Check**: `curl -f http://localhost:8000/api/health`
- **Endpoint**: `/api/health` exists in `backend/registry_backend/urls.py`
- **Dependencies**: `curl` is installed in Dockerfile.prod ✅

### 2. **Entrypoint Script - Database Wait** ⚠️
**Potential Issue**: The entrypoint script waits indefinitely for the database:
```bash
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U postgres 2>/dev/null || pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done
```

**Problems**:
- No timeout - will wait forever if database is unreachable
- Uses `pg_isready` which requires network access to RDS
- If database is in private subnet and security groups are misconfigured, this will hang
- Health check won't pass until database is ready AND app starts

### 3. **Health Check Returns 503 on Database Failure** ⚠️
The health check endpoint returns 503 if database is unavailable:
```python
except Exception as e:
    error_msg = str(e) if settings.DEBUG else "Database unavailable"
    return JsonResponse({"status": "unhealthy", "database": "disconnected", "error": error_msg}, status=503)
```

**Impact**: If database connection fails, health check fails → task marked unhealthy → service doesn't stabilize

### 4. **Task Definition Health Check Timing** ⚠️
```json
"healthCheck": {
  "interval": 30,
  "timeout": 5,
  "retries": 3,
  "startPeriod": 60
}
```

**Analysis**:
- `startPeriod: 60` seconds - health checks ignored for first 60 seconds
- But entrypoint might take longer if waiting for database
- If database wait takes > 60 seconds, health checks start failing immediately

## Diagnostic Steps

### Step 1: Check Service Status
```bash
aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --query 'services[0].{Desired:desiredCount,Running:runningCount,Pending:pendingCount,Deployments:deployments[*].{Status:status,Running:runningCount,Desired:desiredCount}}' \
  --output json
```

### Step 2: Check Recent Events
```bash
aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --query 'services[0].events[:10]' \
  --output table
```

### Step 3: Check Stopped Tasks
```bash
aws ecs list-tasks \
  --cluster event-registry-staging \
  --service-name backend-service \
  --desired-status STOPPED \
  --max-items 5

# Then describe each task
aws ecs describe-tasks \
  --cluster event-registry-staging \
  --tasks <task-arn> \
  --query 'tasks[0].{StoppedReason:stoppedReason,Containers:containers[*].{ExitCode:exitCode,Reason:reason}}' \
  --output json
```

### Step 4: Check CloudWatch Logs
```bash
aws logs tail /ecs/event-registry-staging/backend --follow --since 30m
```

Look for:
- "Database not ready, waiting..." (indicates database connection issue)
- "Database is ready!" (confirms database connection succeeded)
- Application startup errors
- Health check failures

### Step 5: Check Task Health Status
```bash
aws ecs list-tasks \
  --cluster event-registry-staging \
  --service-name backend-service \
  --desired-status RUNNING

aws ecs describe-tasks \
  --cluster event-registry-staging \
  --tasks <task-arn> \
  --query 'tasks[0].{HealthStatus:healthStatus,Containers:containers[*].{HealthStatus:healthStatus,LastStatus:lastStatus}}' \
  --output json
```

## Most Likely Causes

### 1. **Database Connection Failure** (Most Likely)
**Symptoms**:
- Tasks stuck in "Pending" or "Running" but unhealthy
- CloudWatch logs show "Database not ready, waiting..." repeatedly
- Health checks failing (503 responses)

**Causes**:
- Security group not allowing traffic from ECS tasks to RDS
- RDS endpoint incorrect in DATABASE_URL
- RDS in wrong subnet or not accessible
- Database credentials incorrect

**Fix**:
- Verify security group rules
- Check DATABASE_URL in SSM Parameter Store
- Test database connectivity from ECS task

### 2. **Health Check Failing**
**Symptoms**:
- Tasks running but marked unhealthy
- Health check returning 503 (database unavailable)
- Service events show "service backend-service has failed to start a new task"

**Causes**:
- Database connection failing → health check returns 503
- Application not starting properly
- Health endpoint not accessible

**Fix**:
- Ensure database is accessible
- Check application logs for startup errors
- Verify health endpoint is working

### 3. **Application Startup Failure**
**Symptoms**:
- Tasks stopping immediately after start
- Exit code non-zero
- CloudWatch logs show Python/Django errors

**Causes**:
- Missing environment variables
- Import errors
- Configuration errors

**Fix**:
- Check all required SSM parameters exist
- Verify environment variables are correct
- Review application logs

## Quick Fixes to Try

### Fix 1: Add Timeout to Database Wait
Modify `backend/entrypoint.sh` to add a timeout:

```bash
# Wait for database with timeout (max 60 seconds)
TIMEOUT=60
ELAPSED=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U postgres 2>/dev/null || [ $ELAPSED -ge $TIMEOUT ]; do
  echo "Database not ready, waiting... ($ELAPSED/$TIMEOUT seconds)"
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "⚠️  WARNING: Database not ready after $TIMEOUT seconds, continuing anyway..."
fi
```

### Fix 2: Make Health Check More Resilient
Modify health check to not fail immediately if database is temporarily unavailable during startup.

### Fix 3: Increase Health Check Start Period
Increase `startPeriod` in task definition to give more time for database connection:

```json
"startPeriod": 120  // Increase from 60 to 120 seconds
```

## Next Steps

1. **Run the diagnostic script**:
   ```bash
   ./scripts/diagnose-ecs-service.sh event-registry-staging backend-service
   ```

2. **Check CloudWatch logs** for specific errors

3. **Verify database connectivity** from ECS tasks

4. **Check security group rules** allow traffic from ECS to RDS

5. **Review service events** for specific failure reasons

