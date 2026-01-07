import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

// Get frontend URL for metadata base (used for resolving relative URLs in Open Graph images)
function getMetadataBase(): string {
  const frontendUrl = process.env.NEXT_PUBLIC_COMPANY_HOMEPAGE || 
                      process.env.NEXT_PUBLIC_API_BASE || 
                      'http://localhost:3000'
  // Remove /api suffix if present
  return frontendUrl.replace('/api', '')
}

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBase()),
  title: 'Event Registry',
  description: 'Event Registry - Invitations, RSVP, and Gift Registry for any celebration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
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
