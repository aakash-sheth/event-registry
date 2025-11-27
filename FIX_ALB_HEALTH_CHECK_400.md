# Fix: ALB Health Check Returning HTTP 400

## Problem
ALB health checks are returning HTTP 400 (Bad Request), causing tasks to be marked unhealthy and preventing service stabilization.

## Root Cause
Django's `ALLOWED_HOSTS` validation rejects requests where the `Host` header doesn't match the allowed hosts. ALB health checks send requests with the task's private IP address (e.g., `10.0.4.50`) as the `Host` header, which doesn't match the ALB DNS name in `ALLOWED_HOSTS` (e.g., `staging-alb-33342285.us-east-1.elb.amazonaws.com`).

## Solution Applied

### 1. Created Health Check Middleware
Created `backend/apps/common/middleware.py` that intercepts health check requests and sets a valid `Host` header before Django's `CommonMiddleware` validates `ALLOWED_HOSTS`.

### 2. Updated Settings
- Added `HealthCheckMiddleware` to `MIDDLEWARE` list (before `CommonMiddleware`)
- Updated `ALLOWED_HOSTS` handling to be more flexible

## Alternative Solution (if middleware doesn't work)

If the middleware approach doesn't work, update the SSM parameter:

```bash
# Get current value
aws ssm get-parameter --name "/event-registry-staging/ALLOWED_HOSTS" --query "Parameter.Value" --output text

# Update to include ALB DNS and allow health checks
# Note: Django doesn't support wildcards, so we need to include specific values
aws ssm put-parameter \
  --name "/event-registry-staging/ALLOWED_HOSTS" \
  --value "staging-alb-33342285.us-east-1.elb.amazonaws.com,localhost,127.0.0.1" \
  --type "String" \
  --overwrite
```

However, this still won't work for private IPs from ALB health checks, so the middleware approach is better.

## Testing

After deploying, verify health checks work:

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:630147069059:targetgroup/staging-backend-tg/0a96eecafed22037

# Check service events
aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --query 'services[0].events[:5]' \
  --output table
```

## Expected Result
- Health checks should return HTTP 200 instead of 400
- Tasks should be marked healthy
- Service should stabilize successfully

