/**
 * Brand utility - Single source of truth for branding across the app
 * Reads from environment variables with fallback defaults
 */

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Ekfern'
// Company homepage is the same as the frontend URL (base URL)
// Fallback chain: NEXT_PUBLIC_COMPANY_HOMEPAGE → NEXT_PUBLIC_API_BASE → default URL
export const COMPANY_HOMEPAGE = process.env.NEXT_PUBLIC_COMPANY_HOMEPAGE || process.env.NEXT_PUBLIC_API_BASE || 'https://eventregistry.com'

// Generic envelope image for link previews (common fallback for all events)
// This should be a publicly accessible URL (S3, CDN, or public asset)
// Recommended size: 1200x630px for optimal Open Graph display
export const GENERIC_ENVELOPE_IMAGE = process.env.NEXT_PUBLIC_GENERIC_ENVELOPE_IMAGE || 
  'https://event-registry-staging-uploads-1764200910.s3.amazonaws.com/events/ekfern_banner/ekfern_envelope.png'

