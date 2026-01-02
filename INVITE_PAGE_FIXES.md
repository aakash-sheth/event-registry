# Invite Page Production Fixes

This document summarizes the fixes applied to diagnose and resolve production-only invite page failures.

## ✅ Fixes Applied

### 1. Enhanced SSR API Base Logging and Validation

**File**: `frontend/app/invite/[slug]/page.tsx`

**Changes**:
- Added defensive logging to `getApiBase()` function
- Detects and warns when `BACKEND_API_BASE` is missing and falls back to CloudFront URL
- Logs API base resolution in production for debugging
- Validates API base URL to prevent routing loops

**What it does**:
- Logs critical warning if `BACKEND_API_BASE` is not set and `NEXT_PUBLIC_API_BASE` points to CloudFront
- Provides detailed diagnostic information in CloudWatch logs
- Helps identify the root cause of 504 timeouts and routing loops

### 2. Improved Error Handling and Diagnostics

**File**: `frontend/app/invite/[slug]/page.tsx`

**Changes**:
- Enhanced error logging in `fetchInviteData()` and `fetchEventData()`
- Added timing information for SSR operations
- Improved 404 error diagnostics with possible causes
- Logs all API fetch attempts with status codes

**What it does**:
- Logs non-200 responses with status codes
- Tracks SSR duration for performance monitoring
- Provides actionable diagnostic information in error cases
- Helps distinguish between network errors, timeouts, and 404s

### 3. Production Diagnostic Script

**File**: `infrastructure/diagnose-invite-issues.sh`

**Usage**:
```bash
./infrastructure/diagnose-invite-issues.sh <slug>
# Example:
./infrastructure/diagnose-invite-issues.sh aakash-alisha
```

**What it checks**:
1. ✅ SSM parameter `BACKEND_API_BASE` exists and points to ALB (not CloudFront)
2. ✅ SSM parameter `NEXT_PUBLIC_API_BASE` configuration
3. ✅ ECS task definition includes `BACKEND_API_BASE` secret
4. ✅ API endpoint accessibility (CloudFront and direct backend)
5. ✅ CloudFront configuration requirements (manual verification)

## 🔍 Root Causes Identified

### 1. SSR API Base Routing Loop (HIGHEST PRIORITY)

**Problem**: If `BACKEND_API_BASE` SSM parameter is missing or misconfigured, SSR falls back to `NEXT_PUBLIC_API_BASE`, which points to CloudFront. This causes:
- Frontend SSR → CloudFront → Frontend → CloudFront (infinite loop)
- 504 Gateway Timeout errors
- Invite pages never render

**Fix**:
```bash
# Verify BACKEND_API_BASE is set correctly
aws ssm get-parameter --name "/event-registry-staging/BACKEND_API_BASE" --query "Parameter.Value" --output text

# If missing or wrong, set it to ALB URL:
aws ssm put-parameter \
  --name "/event-registry-staging/BACKEND_API_BASE" \
  --value "http://<your-alb-dns-name>" \
  --type "String" \
  --overwrite
```

**Verification**: Check CloudWatch logs for `[SSR API Base]` messages. Should see `BACKEND_API_BASE` is set, not falling back to CloudFront URL.

### 2. Unpublished Invite Page

**Problem**: If invite page exists but `is_published=False`, backend returns 404.

**Fix**:
```bash
# Check invite page status
python manage.py check_invite_page <slug>

# If unpublished, publish via admin or API
# (See backend/apps/events/admin.py or API endpoint)
```

**Verification**: Backend API returns 404 for unpublished pages (by design for security).

### 3. CloudFront RSC Caching

**Problem**: CloudFront may cache RSC payloads instead of HTML if Accept header not forwarded.

**Fix**: Verify CloudFront configuration:
- Forward "Accept" header (CRITICAL)
- Do NOT forward "Rsc" header
- See `CLOUDFRONT_CACHE_CONFIGURATION.md` for details

### 4. API Routing Misconfiguration

**Problem**: If `/api/*` paths don't route to backend, client-side requests fail.

**Fix**: Verify ALB/CloudFront routing:
- `/api/*` should route to backend target group
- Or CloudFront should route `/api/*` to backend ALB

## 📊 Monitoring and Debugging

### CloudWatch Logs

Check these log groups for diagnostic information:

1. **Frontend SSR Logs**: `/ecs/event-registry-staging/frontend`
   - Look for: `[SSR API Base]`, `[InvitePage SSR]`
   - Key indicators:
     - `BACKEND_API_BASE: NOT SET` → Routing loop risk
     - `isCloudFront: true` → Potential loop
     - `duration: >5000ms` → Timeout risk

2. **Backend API Logs**: `/ecs/event-registry-staging/backend`
   - Look for: `[PublicInviteViewSet.retrieve]`
   - Key indicators:
     - `INVITE_404: Unpublished invite page accessed` → Page needs publishing
     - `Step 1 SUCCESS` → Invite page found and published
     - `Step 1 FAILED` → Invite page not found or unpublished

### Diagnostic Checklist

Run the diagnostic script:
```bash
./infrastructure/diagnose-invite-issues.sh <slug>
```

This will check:
- ✅ SSM parameters configured correctly
- ✅ ECS task definition includes BACKEND_API_BASE
- ✅ API endpoints accessible
- ⚠️  CloudFront configuration (manual verification needed)

## 🚀 Deployment Steps

After applying fixes:

1. **Verify SSM Parameters**:
   ```bash
   ./infrastructure/diagnose-invite-issues.sh <slug>
   ```

2. **Redeploy Frontend** (to pick up code changes):
   ```bash
   # Via GitHub Actions or manually update ECS service
   ```

3. **Check CloudWatch Logs**:
   - Verify `[SSR API Base]` logs show `BACKEND_API_BASE` is set
   - Verify no CloudFront loop warnings

4. **Test Invite Page**:
   ```bash
   curl -I https://ekfern.com/invite/<slug>
   # Should return 200, not 504
   ```

5. **Verify Invite Page Status**:
   ```bash
   python manage.py check_invite_page <slug>
   # Should show is_published=True
   ```

## 📝 Code Changes Summary

### Modified Files

1. `frontend/app/invite/[slug]/page.tsx`
   - Enhanced `getApiBase()` with validation and logging
   - Improved error handling in `fetchInviteData()` and `fetchEventData()`
   - Added diagnostic logging throughout SSR flow
   - Enhanced 404 error messages with possible causes

### New Files

1. `infrastructure/diagnose-invite-issues.sh`
   - Comprehensive diagnostic script for production issues
   - Checks SSM parameters, ECS configuration, API endpoints
   - Provides actionable fix recommendations

## 🔗 Related Documentation

- `infrastructure/INVESTIGATION_504_TIMEOUT.md` - Original 504 timeout investigation
- `CLOUDFRONT_CACHE_CONFIGURATION.md` - CloudFront configuration guide
- `PRODUCTION_LOGGING_GUIDE.md` - Production logging best practices
- `backend/apps/events/management/commands/check_invite_page.py` - Invite page status checker

## ⚠️ Important Notes

1. **BACKEND_API_BASE is CRITICAL**: Must be set to ALB URL, not CloudFront URL
2. **Invite pages must be published**: Unpublished pages return 404 (by design)
3. **CloudFront Accept header**: Must be forwarded for RSC to work correctly
4. **Logs are your friend**: All diagnostic information is now in CloudWatch logs

## 🆘 Troubleshooting

If invite page still fails after fixes:

1. Run diagnostic script: `./infrastructure/diagnose-invite-issues.sh <slug>`
2. Check CloudWatch logs for `[SSR API Base]` warnings
3. Verify `BACKEND_API_BASE` SSM parameter is set correctly
4. Check invite page is published: `python manage.py check_invite_page <slug>`
5. Verify CloudFront configuration (Accept header forwarding)
6. Test backend API directly: `curl http://<alb-dns>/api/events/invite/<slug>/`

