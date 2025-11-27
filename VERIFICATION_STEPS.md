# Verification: Is ALLOWED_HOSTS the Root Cause?

## Evidence Supporting This Diagnosis

1. ✅ **ALB health checks returning HTTP 400** - Confirmed from service events
2. ✅ **Web search confirms** - ALLOWED_HOSTS is a common cause of HTTP 400 with ALB health checks
3. ✅ **ALB uses private IPs** - Health checks use task's private IP (10.0.4.50) as Host header
4. ✅ **ALLOWED_HOSTS mismatch** - Set to ALB DNS name, doesn't match private IP

## Potential Issues with Middleware Approach

The middleware modifies `HTTP_HOST` before `CommonMiddleware` runs, which *should* work, but Django's `CommonMiddleware` uses `request.get_host()` which might:
- Cache the host value
- Check it in a way that our modification doesn't help
- Validate using `SERVER_NAME` instead of `HTTP_HOST`

## Alternative Solutions (if middleware doesn't work)

### Option 1: Update ALLOWED_HOSTS SSM Parameter
Add the ALB DNS name explicitly (already done), but this won't help with private IPs.

### Option 2: Use '*' for ALLOWED_HOSTS (Staging Only)
```bash
aws ssm put-parameter \
  --name "/event-registry-staging/ALLOWED_HOSTS" \
  --value "*" \
  --type "String" \
  --overwrite
```
**Security Note**: This is acceptable for staging but not recommended for production.

### Option 3: Configure ALB Health Check Host Header
Configure the target group to send a specific Host header, but ALB doesn't support this directly.

## Recommended Verification Steps

1. **Deploy the middleware fix** and test
2. **If it doesn't work**, check CloudWatch logs for DisallowedHost errors
3. **If middleware fails**, use Option 2 (set ALLOWED_HOSTS to '*') for staging
4. **Monitor health checks** after deployment

## Conclusion

**Yes, this is most likely the root cause** based on:
- The symptoms match exactly (HTTP 400 from ALB health checks)
- Common known issue with Django + ALB
- No other errors in logs

The middleware approach should work, but if it doesn't, the fallback (ALLOWED_HOSTS='*' for staging) is acceptable.

