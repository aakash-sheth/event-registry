# Fix: JavaScript Chunks Returning HTML (MIME Type Error)

## Problem

JavaScript chunks are being served with MIME type `text/html` instead of `application/javascript`, causing:
- `ChunkLoadError: Loading chunk failed`
- React errors
- Blank page after initial render

**Error Messages:**
```
Refused to execute script from 'https://ekfern.com/_next/static/chunks/721-4ef51e7bec297068.js' 
because its MIME type ('text/html') is not executable
```

## Root Cause

Requests to `/_next/static/chunks/*.js` are returning HTML (likely a 404 page or redirect) instead of the actual JavaScript files. This happens when:

1. **CloudFront doesn't have proper cache behavior for `/_next/static/*` paths**
2. **ALB is routing `/_next/*` incorrectly** (should go to frontend)
3. **Next.js build output is missing** or not deployed correctly
4. **CloudFront is caching HTML responses** for JS file requests

## Solution

### Step 1: Verify Next.js Build Output

Ensure the build includes static files:

```bash
# Check if static files exist in build output
ls -la frontend/.next/static/chunks/
```

If files are missing, rebuild:
```bash
cd frontend
npm run build
```

### Step 2: Add CloudFront Cache Behavior for Static Files

CloudFront needs a cache behavior specifically for `/_next/static/*` paths:

1. Go to **AWS CloudFront Console** → Your Distribution → **Behaviors** tab
2. Click **"Create behavior"**
3. Configure:
   - **Path pattern**: `/_next/static/*`
   - **Origin**: ALB (same as default)
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP methods**: GET, HEAD, OPTIONS
   - **Cache policy**: 
     - Use **"CachingOptimized"** or create custom policy with:
       - Minimum TTL: 0
       - Maximum TTL: 31536000 (1 year)
       - Default TTL: 31536000 (1 year)
       - Origin cache control: Enabled
   - **Origin request policy**: "CORS-S3Origin" or minimal (no cookies needed)
   - **Response headers policy**: None
4. Set **Priority**: Higher than default (e.g., 0 or 1) - must be before `*` pattern
5. Click **"Create behavior"**

**Why Higher Priority?** CloudFront evaluates behaviors in order. `/_next/static/*` must match before the default `*` pattern.

### Step 3: Verify ALB Routing

Ensure ALB routes `/_next/*` to the frontend:

1. Go to **AWS ALB Console** → Your Load Balancer → **Listeners** tab
2. Check routing rules:
   - `/api/*` → Backend target group ✅
   - `*` (default) → Frontend target group ✅

The default `*` rule should catch `/_next/*` and route to frontend.

### Step 4: Invalidate CloudFront Cache

After configuration changes, invalidate the cache:

```bash
./infrastructure/refresh-cloudfront.sh
```

Or manually:
1. CloudFront Console → Your Distribution → **Invalidations** tab
2. Click **"Create invalidation"**
3. Enter paths: `/_next/static/*`
4. Click **"Create invalidation"**

### Step 5: Verify Fix

Test that JS files are served correctly:

```bash
# Test a specific chunk file
curl -I https://ekfern.com/_next/static/chunks/webpack-09e8564e9dfddc10.js

# Should return:
# Content-Type: application/javascript
# Cache-Control: public, max-age=31536000, immutable
# Status: 200 OK
```

If you see `Content-Type: text/html` or `404 Not Found`, the routing is still incorrect.

## Expected CloudFront Cache Behaviors (Priority Order)

1. **`/_next/static/*`** (Priority: 0)
   - Cache policy: Long TTL (1 year)
   - Origin: ALB → Frontend

2. **`/api/*`** (Priority: 1)
   - Cache policy: CachingDisabled or minimal
   - Origin: ALB → Backend

3. **`*`** (Default, Priority: 2)
   - Cache policy: Respect origin headers
   - Origin: ALB → Frontend

## Next.js Configuration

The `next.config.js` has been updated to add proper cache headers for `/_next/static/*`:

```javascript
{
  source: '/_next/static/:path*',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable',
    },
  ],
}
```

This ensures Next.js serves static files with correct headers.

## Verification Checklist

- [ ] Next.js build includes `/_next/static/chunks/` directory
- [ ] CloudFront has cache behavior for `/_next/static/*` with higher priority than default
- [ ] ALB routes `/_next/*` to frontend (via default `*` rule)
- [ ] CloudFront cache invalidated for `/_next/static/*`
- [ ] JS files return `Content-Type: application/javascript`
- [ ] JS files return `200 OK` status
- [ ] Page loads without ChunkLoadError

## Additional Debugging

If issue persists, check:

1. **Browser Network Tab**: 
   - Look for failed requests to `/_next/static/chunks/*.js`
   - Check response headers (should be `application/javascript`)
   - Check response body (should be JavaScript code, not HTML)

2. **CloudFront Logs**:
   - Check if requests are hitting the correct origin
   - Verify cache hit/miss behavior

3. **ALB Access Logs**:
   - Verify `/_next/*` requests are reaching frontend target group
   - Check response status codes

4. **ECS Task Logs**:
   - Check if Next.js is receiving requests for static files
   - Look for 404 errors in logs

## Related Files

- `frontend/next.config.js` - Cache headers configuration
- `CLOUDFRONT_CACHE_CONFIGURATION.md` - General CloudFront setup
- `infrastructure/refresh-cloudfront.sh` - Cache invalidation script
