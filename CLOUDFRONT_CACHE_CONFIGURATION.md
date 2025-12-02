# CloudFront Cache Configuration Guide

This guide documents the CloudFront console verification steps to ensure optimal caching for invitation pages.

## Prerequisites

- Access to AWS CloudFront Console
- CloudFront Distribution ID (can be found in SSM parameter `/event-registry-staging/CLOUDFRONT_DISTRIBUTION_ID` or by running `./infrastructure/refresh-cloudfront.sh`)

## Verification Steps

### 1. Access CloudFront Distribution

1. Go to AWS CloudFront Console: https://console.aws.amazon.com/cloudfront/
2. Find your distribution (search by domain name or distribution ID)
3. Click on the distribution ID to open distribution settings

### 2. Verify Cache Behaviors

1. Click on the **"Behaviors"** tab
2. Select the **default behavior** (or the behavior that matches your invitation pages)
3. Click **"Edit"**

#### Cache Key and Origin Requests

1. Under **"Cache key and origin requests"**, you have two options:

   **Option A: Legacy Cache Settings (Recommended)**
   - Select **"Legacy cache settings"**
   - **Query strings**: None (or Forward if needed for dynamic content)
   - **Headers**: Forward "Host" header (required for Next.js)
   - **Cookies**: None (for public invitation pages)
   
   **Why Legacy?** Managed cache policies like "CachingOptimizedForUncompressedObjects" have:
   - Minimum TTL of 1 second (not 0), which prevents fully respecting origin Cache-Control headers
   - Default TTL of 24 hours (too long - we want to respect s-maxage=3600 from Next.js)
   - These settings cannot be modified
   
   **Option B: Custom Cache Policy (Alternative)**
   - Create a custom cache policy with:
     - Minimum TTL: 0 (to respect origin headers)
     - Maximum TTL: 86400 (24 hours)
     - Default TTL: 3600 (1 hour)
     - Origin cache control: Enabled
     - Headers: Forward "Host"
     - Cookies: None

#### TTL Settings

1. Under **"TTL settings"** (if using legacy cache settings):
   - **Minimum TTL**: `0` (respect origin Cache-Control headers)
   - **Maximum TTL**: `86400` (24 hours - matches stale-while-revalidate)
   - **Default TTL**: `3600` (1 hour - matches s-maxage)

2. If using a **Custom Cache Policy** (Option B), verify:
   - "Origin cache control" is enabled
   - Minimum TTL is 0 (critical - allows respecting origin headers)
   - Maximum TTL is 86400
   - Default TTL is 3600

### 3. Verify Origin Settings

1. Click on the **"Origins"** tab
2. Select your origin (ALB or ECS service)
3. Click **"Edit"**

Ensure:
- **Origin domain**: Points to your ALB or ECS service
- **Origin path**: Leave empty (unless using a subdirectory)
- **Origin ID**: Should be descriptive (e.g., "staging-alb-frontend")

### 4. Verify Response Headers Policy (Optional but Recommended)

1. Go to **"Policies"** → **"Response headers policies"**
2. Create or edit a policy that:
   - Allows `Cache-Control` header from origin
   - Does not override `Cache-Control` headers

### 5. Test Cache Behavior

After configuration, test that caching works:

1. **First request** (cache miss):
   ```bash
   curl -I https://your-cloudfront-domain.net/invite/test-slug
   ```
   - Should see `X-Cache: Miss from cloudfront` in response
   - Response time: ~500ms-2s (hits origin)

2. **Second request** (cache hit):
   ```bash
   curl -I https://your-cloudfront-domain.net/invite/test-slug
   ```
   - Should see `X-Cache: Hit from cloudfront` in response
   - Response time: ~50-100ms (served from cache)

3. **Check Cache-Control header**:
   ```bash
   curl -I https://your-cloudfront-domain.net/invite/test-slug | grep -i cache-control
   ```
   - Should see: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400, max-age=60`

### 6. Monitor Cache Performance

1. Go to **CloudWatch** → **Metrics** → **CloudFront**
2. Monitor:
   - **Cache hit ratio**: Should be > 80% after initial warm-up
   - **Requests**: Total requests to distribution
   - **Bytes downloaded**: Should decrease as cache hit ratio increases

## Expected Configuration Summary

| Setting | Value | Reason |
|---------|-------|--------|
| Minimum TTL | 0 | Respect origin Cache-Control headers |
| Maximum TTL | 86400 (24h) | Match stale-while-revalidate duration |
| Default TTL | 3600 (1h) | Match s-maxage from Next.js headers |
| Query Strings | Forward if needed | For dynamic content (if any) |
| Cookies | None | Public pages don't need cookies |
| Headers | Forward Host | Required for Next.js routing |

## Troubleshooting

### Pages not caching

1. **Check response headers**: Ensure `Cache-Control` header is present in origin response
2. **Verify TTL settings**: Minimum TTL must be 0 to respect origin headers
3. **Check cache policy**: If using cache policy, ensure it's configured to respect origin headers

### Cache invalidation

If you need to clear cache after deployment:

```bash
./infrastructure/refresh-cloudfront.sh
```

Or manually:
1. Go to CloudFront Console → Your Distribution → **"Invalidations"** tab
2. Click **"Create invalidation"**
3. Enter paths: `/*` (all paths) or `/invite/*` (invitation pages only)
4. Click **"Create invalidation"**

### Slow first request

This is expected behavior:
- First request: Cache miss → hits origin → caches response (~500ms-2s)
- Subsequent requests: Cache hit → served from edge (~50-100ms)

To minimize impact:
- Use ISR (Incremental Static Regeneration) - already configured
- Pre-warm cache for popular pages (optional, see plan for details)

## Verification Checklist

- [ ] Cache behaviors configured to respect `Cache-Control` headers
- [ ] Minimum TTL set to 0
- [ ] Maximum TTL set to 86400 (24 hours)
- [ ] Host header forwarded to origin
- [ ] Cookies not forwarded (for public pages)
- [ ] Cache-Control header visible in response
- [ ] Cache hit ratio > 80% after warm-up
- [ ] Pages load instantly on second visit

## Additional Resources

- [AWS CloudFront Cache Policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html)
- [Next.js Caching Documentation](https://nextjs.org/docs/app/building-your-application/caching)
- [CloudFront TTL Settings](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html)

