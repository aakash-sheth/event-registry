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
        // Apply to all invitation pages
        source: '/invite/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            // Cache for 1 hour, serve stale for 24 hours while revalidating
            value: 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=60',
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

