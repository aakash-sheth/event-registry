/**
 * Returns the public site origin (no trailing slash).
 *
 * This is used for metadataBase, robots/sitemap, and absolute URLs in meta tags.
 * Prefer explicitly configured public URL over any API base.
 */
export function getSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_COMPANY_HOMEPAGE ||
    process.env.NEXT_PUBLIC_SITE_URL

  if (explicit && typeof explicit === 'string') {
    return explicit.replace(/\/$/, '')
  }

  // Vercel sets VERCEL_URL to the host (no protocol)
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl && typeof vercelUrl === 'string') {
    return `https://${vercelUrl}`.replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}

