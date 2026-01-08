/**
 * Brand utility - Single source of truth for branding across the app
 * Reads from environment variables with fallback defaults
 */

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Ekfern'
// Company homepage is the same as the frontend URL (base URL)
// Fallback chain: NEXT_PUBLIC_COMPANY_HOMEPAGE → NEXT_PUBLIC_API_BASE → default URL
export const COMPANY_HOMEPAGE = process.env.NEXT_PUBLIC_COMPANY_HOMEPAGE || process.env.NEXT_PUBLIC_API_BASE || 'https://eventregistry.com'

