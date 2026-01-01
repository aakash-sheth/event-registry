# 504 Gateway Timeout Investigation

## Problem
CloudFront is returning 504 Gateway Timeout errors for invite pages (`/invite/[slug]`).

## Root Cause Analysis

### Issue 1: Frontend Server-Side Routing Loop (FIXED)
- **Problem**: Frontend Next.js server was calling `https://ekfern.com/api/...` (CloudFront URL)
- **Result**: CloudFront routed back to frontend, creating circular loop
- **Fix**: Added `BACKEND_API_BASE` environment variable pointing to ALB
- **Status**: ✅ Task definition updated, service deploying

### Issue 2: CloudFront Origin Timeout (LIKELY CAUSE)
- **Problem**: CloudFront default origin timeout is **30 seconds**
- **Current Flow**:
  1. User → CloudFront → Frontend Next.js (SSR)
  2. Frontend SSR → Backend API (10s timeout × 3 retries = 30s)
  3. Plus SSR rendering time
  4. **Total > 30s → CloudFront times out → 504 Error**

### Issue 3: Backend API Response Time
- Frontend logs show backend API calls timing out (10 seconds)
- Backend may be slow or not responding

## Solutions

### Immediate Fix: Increase CloudFront Origin Timeout
CloudFront origin timeout can be increased from 30s to 60s (maximum).

**Steps:**
1. Get CloudFront distribution config (requires `cloudfront:GetDistributionConfig` permission)
2. Update `Origin.ConnectionTimeout` to 60 seconds
3. Update distribution (takes 15-20 minutes to deploy)

**Note**: Current IAM user doesn't have CloudFront permissions. Need admin access or IAM policy update.

### Alternative: Reduce Frontend Timeout
- Reduce frontend API timeout from 10s to 5s
- Reduce retries from 3 to 2
- Total: 5s × 2 = 10s (well under 30s CloudFront limit)

### Long-term: Optimize Backend
- Backend API should respond in < 5 seconds
- Already added `CONN_MAX_AGE` for connection pooling
- Check database query performance
- Add caching if needed

## Current Configuration

- **ALB Idle Timeout**: 60 seconds ✅
- **CloudFront Origin Timeout**: 30 seconds (default) ⚠️
- **Frontend API Timeout**: 10 seconds × 3 retries = 30s ⚠️
- **Backend Response Time**: Unknown (needs investigation)

## Next Steps

1. ✅ Wait for frontend deployment to complete (BACKEND_API_BASE)
2. ⚠️ Check if CloudFront timeout can be increased (need permissions)
3. 🔍 Monitor backend response times
4. 🔧 Consider reducing frontend timeout if backend is consistently slow

