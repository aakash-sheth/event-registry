import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { BRAND_NAME } from '@/lib/brand_utility'
import { getSiteUrl } from '@/lib/site-url'

// Get frontend URL for metadata base (used for resolving relative URLs in Open Graph images)
function getMetadataBase(): string {
  return getSiteUrl()
}

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBase()),
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} - Invitations, RSVP, and Gift Registry for any celebration`,
  applicationName: BRAND_NAME,
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: `${BRAND_NAME} - Invitations, RSVP, and Gift Registry for any celebration`,
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: BRAND_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_NAME,
    description: `${BRAND_NAME} - Invitations, RSVP, and Gift Registry for any celebration`,
    images: ['/og-image.svg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Preconnect to Google Fonts for better performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Favicon - using emoji as simple icon */}
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌿</text></svg>" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
