/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
    'react-markdown',
  ],
  // Add cache headers for CloudFront caching
  async headers() {
    return [
      {
        // CRITICAL: Next.js static files must be cached properly
        // This ensures JS chunks are served with correct MIME type
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // Cache static assets for 1 year (immutable)
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Apply to all invitation pages (public, cacheable)
        source: '/invite/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            // Cache for 1 hour, serve stale for 24 hours while revalidating
            value: 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=60',
          },
        ],
      },
      {
        // Apply to protected host routes (no cache, always fresh)
        source: '/host/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // No caching for protected routes - always fetch fresh
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
  webpack: (config) => {
    // Ensure proper module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
}

module.exports = nextConfig

