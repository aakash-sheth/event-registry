/**
 * Image URL utilities for converting S3 URLs to CloudFront URLs
 */

/**
 * Convert S3 URL to CloudFront URL if CloudFront is configured
 * @param s3Url - Original S3 URL (or any URL)
 * @returns CloudFront URL if configured and URL is S3, otherwise original URL
 */
export function convertToCloudFrontUrl(s3Url: string): string {
  if (!s3Url) return s3Url
  
  // Get CloudFront domain from environment (set at build time)
  const cloudfrontDomain = process.env.NEXT_PUBLIC_CLOUDFRONT_IMAGE_DOMAIN
  
  if (!cloudfrontDomain) {
    // CloudFront not configured, return original URL
    return s3Url
  }
  
  // Check if URL is an S3 URL
  // Pattern: https://bucket.s3.region.amazonaws.com/path/to/file
  // or: https://bucket.s3.amazonaws.com/path/to/file
  const s3UrlPattern = /^https:\/\/([^/]+)\.s3(?:\.([^.]+))?\.amazonaws\.com\/(.+)$/
  const match = s3Url.match(s3UrlPattern)
  
  if (match && match[3]) {
    // Extract the path (everything after bucket name)
    const imagePath = match[3]
    // Return CloudFront URL
    return `https://${cloudfrontDomain}/${imagePath}`
  }
  
  // If URL doesn't match S3 pattern, return as-is (might already be CloudFront or other CDN)
  return s3Url
}

