# CloudFront Routing Verification Guide

## Problem
When accessing `https://ekfern.com/api/admin/login/`, users are being redirected to the landing page instead of seeing the Django admin login page.

## Root Cause Analysis

### Current Architecture
1. **CloudFront Distribution** (`E1O23G36MWQOLT`) → Routes all requests to ALB
2. **ALB** (`staging-alb-33342285.us-east-1.elb.amazonaws.com`) → Has routing rules:
   - `/api/*` → Backend target group (Django)
   - `*` (default) → Frontend target group (Next.js)

### The Issue
CloudFront likely has **only one origin** (the ALB), and relies on the ALB to route `/api/*` to the backend. However, if CloudFront doesn't have a cache behavior that properly handles `/api/*` paths, it might be:
1. Caching the wrong responses
2. Not forwarding the correct headers
3. Routing to the wrong origin

## Verification Steps

### Step 1: Check CloudFront Distribution Configuration

**Required Permissions**: `cloudfront:GetDistributionConfig`

1. Go to AWS CloudFront Console: https://console.aws.amazon.com/cloudfront/
2. Find distribution `E1O23G36MWQOLT` (or search for `ekfern.com`)
3. Click on the distribution ID
4. Go to the **"Origins"** tab
5. Verify you have:
   - **One origin** pointing to the ALB (correct setup)
   - **OR two origins** (one for frontend, one for backend) - this would be incorrect

### Step 2: Check Cache Behaviors

1. Go to the **"Behaviors"** tab
2. Check if there's a cache behavior for `/api/*`:
   - **If YES**: Verify it routes to the backend origin (or ALB with correct path)
   - **If NO**: This is the problem - you need to create one

### Step 3: Expected Configuration

#### Option A: Single Origin (ALB) - Recommended
- **Default Behavior**: `*` → ALB origin
- **Cache Behavior for `/api/*`**: 
  - Path pattern: `/api/*`
  - Origin: ALB (same as default)
  - Cache policy: CachingDisabled (or minimal caching for API endpoints)
  - Origin request policy: AllViewer (forward all headers/cookies)

#### Option B: Two Origins (Frontend + Backend) - Not Recommended
- **Frontend Origin**: Points to frontend target group
- **Backend Origin**: Points to backend target group
- **Default Behavior**: `*` → Frontend origin
- **Cache Behavior for `/api/*`**: Routes to Backend origin

## Fix: Add Cache Behavior for `/api/*`

If CloudFront doesn't have a cache behavior for `/api/*`, you need to add one:

### Via AWS Console:

1. Go to CloudFront distribution → **"Behaviors"** tab
2. Click **"Create behavior"**
3. Configure:
   - **Path pattern**: `/api/*`
   - **Origin and origin groups**: Select your ALB origin
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - **Cache policy**: 
     - **Option 1**: Use "CachingDisabled" (recommended for admin endpoints)
     - **Option 2**: Use "CachingOptimized" with minimal TTL
   - **Origin request policy**: "AllViewer" (forward all headers/cookies)
   - **Response headers policy**: None (or custom if needed)
4. Set **Priority**: Higher than default (e.g., 0 or 1)
5. Click **"Create behavior"**

### Via AWS CLI (if you have permissions):

```bash
# First, get the current distribution config
aws cloudfront get-distribution-config \
  --id E1O23G36MWQOLT \
  --output json > cloudfront-config.json

# Edit the JSON to add a cache behavior for /api/*
# Then update the distribution
aws cloudfront update-distribution \
  --id E1O23G36MWQOLT \
  --if-match <ETag from get-distribution-config> \
  --distribution-config file://cloudfront-config.json
```

## Verification After Fix

1. **Test admin login page**:
   ```bash
   curl -I https://ekfern.com/api/admin/login/
   ```
   - Should return `200 OK` with Django admin HTML
   - Should NOT redirect to landing page

2. **Test API health endpoint**:
   ```bash
   curl -I https://ekfern.com/api/health
   ```
   - Should return `200 OK` from backend

3. **Test frontend page**:
   ```bash
   curl -I https://ekfern.com/
   ```
   - Should return `200 OK` with Next.js HTML

## Current Status

- ✅ **ALB Routing**: Confirmed working (routes `/api/*` to backend)
- ⚠️ **CloudFront Routing**: Needs verification (may be missing `/api/*` cache behavior)
- ✅ **Backend Code**: Fixed redirect loop issue

## Next Steps

1. **Verify CloudFront configuration** (requires admin access or CloudFront permissions)
2. **Add cache behavior for `/api/*`** if missing
3. **Deploy backend changes** (fix redirect loop)
4. **Test admin login** after both fixes

