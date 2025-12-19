import { Metadata } from 'next'
import React from 'react'
import InvitePageClient from './InvitePageClient'
import { InviteConfig, Tile } from '@/lib/invite/schema'
import ImageTileSSR from '@/components/invite/tiles/ImageTileSSR'
import TitleTileSSR from '@/components/invite/tiles/TitleTileSSR'
import EventDetailsTileSSR from '@/components/invite/tiles/EventDetailsTileSSR'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'

// ISR: Revalidate every hour (3600 seconds)
export const revalidate = 3600

interface Event {
  id: number
  title: string
  date?: string
  description?: string
  banner_image?: string
  page_config?: InviteConfig
  has_rsvp?: boolean
  has_registry?: boolean
}

// Get API base URL for server-side fetching
// In Docker, use BACKEND_API_BASE (service name), otherwise use NEXT_PUBLIC_API_BASE
// Client-side will use NEXT_PUBLIC_API_BASE (which is localhost:8000 from browser)
function getApiBase(): string {
  return process.env.BACKEND_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
}

// Get frontend URL for absolute URL conversion (for meta tags, images, etc.)
// Uses NEXT_PUBLIC_COMPANY_HOMEPAGE or NEXT_PUBLIC_API_BASE (which should be the frontend URL)
function getFrontendUrl(): string {
  return process.env.NEXT_PUBLIC_COMPANY_HOMEPAGE || process.env.NEXT_PUBLIC_API_BASE || 'https://eventregistry.com'
}

// Fetch event data on the server
async function fetchEventData(slug: string): Promise<Event | null> {
  try {
    const apiBase = getApiBase()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
    
    const response = await fetch(`${apiBase}/api/registry/${slug}/`, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      // Cache for 1 hour to reduce API calls (matches page revalidation)
      // But add cache-busting for development to see latest data
      next: { revalidate: process.env.NODE_ENV === 'development' ? 0 : 3600 },
      cache: process.env.NODE_ENV === 'development' ? 'no-store' : 'default',
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data
  } catch (error: any) {
    // Only log non-timeout errors (timeouts are expected in slow network conditions)
    if (error.name !== 'AbortError') {
      console.error('Failed to fetch event data for metadata:', error)
    }
    return null
  }
}

// Generate metadata for Open Graph and Twitter Cards
export async function generateMetadata({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<Metadata> {
  const event = await fetchEventData(params.slug)

  // Get frontend URL for absolute URL conversion
  const frontendUrl = getFrontendUrl()
  const baseUrl = frontendUrl.replace('/api', '')
  const pageUrl = `${baseUrl}/invite/${params.slug}`

  if (!event) {
    return {
      title: 'Event Invitation',
      description: 'Join us for a special celebration',
      robots: {
        index: false, // Don't index 404 pages
        follow: false,
      },
      openGraph: {
        title: 'Event Invitation',
        description: 'Join us for a special celebration',
        type: 'website',
        url: pageUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Event Invitation',
        description: 'Join us for a special celebration',
      },
    }
  }

  // Extract title from page_config or use event title
  let baseTitle = event.title || 'Event Invitation'
  if (event.page_config?.tiles) {
    const titleTile = event.page_config.tiles.find(
      (tile: any) => tile.type === 'title' && tile.settings?.text
    ) as any
    if (titleTile?.settings?.text) {
      baseTitle = titleTile.settings.text
    }
  }
  
  // Format title with suffix for branding
  const title = `${baseTitle} | Wedding Invitation`

  // Extract description
  let description = event.description || 'Join us for a special celebration'
  if (event.page_config?.tiles) {
    const descTile = event.page_config.tiles.find(
      (tile: any) => tile.type === 'description' && tile.settings?.content
    ) as any
    if (descTile?.settings?.content) {
      // Strip HTML tags and limit length for description
      description = descTile.settings.content.replace(/<[^>]*>/g, '').substring(0, 200)
    }
  }

  // Extract banner image with priority: banner_image > image tile
  let bannerImage: string | undefined = event.banner_image
  
  if (!bannerImage && event.page_config?.tiles) {
    // Find first enabled image tile with a source
    const imageTile = event.page_config.tiles.find(
      (tile: any) => tile.type === 'image' && tile.enabled !== false && tile.settings?.src
    ) as any
    if (imageTile?.settings?.src) {
      bannerImage = imageTile.settings.src
    }
  }

  // Ensure banner image URL is absolute for Open Graph
  let absoluteBannerImage: string | undefined = bannerImage
  if (bannerImage) {
    if (!bannerImage.startsWith('http://') && !bannerImage.startsWith('https://')) {
      // If relative URL (local dev), make it absolute using frontend URL
      absoluteBannerImage = bannerImage.startsWith('/') 
        ? `${baseUrl}${bannerImage}`
        : `${baseUrl}/${bannerImage}`
    } else {
      // Already absolute (S3 URL), use as-is
      absoluteBannerImage = bannerImage
    }
  }

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: pageUrl,
      ...(absoluteBannerImage && { 
        images: [{ 
          url: absoluteBannerImage, 
          alt: title,
          width: 1200,
          height: 630,
        }] 
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(absoluteBannerImage && { images: [absoluteBannerImage] }),
    },
  }

  return metadata
}

// Server component that fetches initial data and renders client component
export default async function InvitePage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  // Handle demo route
  if (params.slug === 'aakash-alisha') {
    return <InvitePageClient slug={params.slug} />
  }

  // Fetch event data on server for initial render
  const event = await fetchEventData(params.slug)

  // If event not found, render error page
  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invite not found</h1>
          <p className="text-gray-600">The invitation you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    )
  }

  // Prepare initial config if event data is available
  let initialConfig: InviteConfig | null = null
  if (event.page_config) {
    initialConfig = {
      ...event.page_config,
      customColors: event.page_config.customColors !== undefined 
        ? event.page_config.customColors 
        : undefined,
    }
  } else {
    // Fallback config
    initialConfig = {
      themeId: 'classic-noir',
      hero: {
        title: event.title || 'Event',
        subtitle: event.description ? event.description.substring(0, 100) : undefined,
        showTimer: !!event.date,
        eventDate: event.date,
        buttons: [
          { label: 'Save the Date', action: 'calendar' },
          ...(event.has_rsvp
            ? [{ label: 'RSVP' as const, action: 'rsvp' as const, href: `/event/${params.slug}/rsvp` }]
            : []),
          ...(event.has_registry
            ? [{ label: 'Registry' as const, action: 'registry' as const, href: `/registry/${params.slug}` }]
            : []),
        ],
      },
      descriptionMarkdown: event.description || undefined,
    }
  }

  // Extract hero tiles (image + title overlay if exists) and event details for SSR
  let heroSSR: React.ReactNode = null
  let eventDetailsSSR: React.ReactNode = null
  const backgroundColor = initialConfig?.customColors?.backgroundColor || '#ffffff'

  if (initialConfig?.tiles && initialConfig.tiles.length > 0) {
    // Find image tile (first enabled image tile)
    const imageTile = initialConfig.tiles.find(
      (t: Tile) => t.type === 'image' && t.enabled !== false && (t.settings as any)?.src
    ) as Tile | undefined

    // Find title tile that overlays on image
    const titleTile = imageTile ? initialConfig.tiles.find(
      (t: Tile) => t.type === 'title' && t.enabled && t.overlayTargetId === imageTile.id
    ) as Tile | undefined : null

    // Find event details tile (first enabled)
    const eventDetailsTile = initialConfig.tiles.find(
      (t: Tile) => t.type === 'event-details' && t.enabled
    ) as Tile | undefined

    // Render hero section server-side
    if (imageTile) {
      const imageSettings = imageTile.settings as any
      heroSSR = (
        <div className="w-full relative">
          <ImageTileSSR 
            settings={imageSettings} 
            hasTitleOverlay={!!titleTile} 
          />
          {titleTile && (
            <TitleTileSSR settings={titleTile.settings as any} />
          )}
        </div>
      )
    }

    // Render event details server-side
    if (eventDetailsTile) {
      const eventDetailsSettings = eventDetailsTile.settings as any
      eventDetailsSSR = (
        <div style={{ backgroundColor }}>
          <EventDetailsTileSSR 
            settings={eventDetailsSettings}
            eventSlug={params.slug}
            eventTitle={event.title}
            eventDate={event.date}
          />
        </div>
      )
    }
  }

  // Render client component with SSR content
  return (
    <InvitePageClient
      slug={params.slug}
      initialEvent={event}
      initialConfig={initialConfig}
      heroSSR={heroSSR}
      eventDetailsSSR={eventDetailsSSR}
    />
  )
}
