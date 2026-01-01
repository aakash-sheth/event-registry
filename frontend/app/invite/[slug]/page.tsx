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

// Fetch invite page data (supports guest token)
// Single attempt - no retries for simple page rendering
async function fetchInviteData(slug: string, guestToken?: string): Promise<any | null> {
    const apiBase = getApiBase()
    const url = guestToken 
      ? `${apiBase}/api/events/invite/${slug}/?g=${encodeURIComponent(guestToken)}`
      : `${apiBase}/api/events/invite/${slug}/`
  
  try {
    const controller = new AbortController()
    const timeout = 5000 // 5 seconds max - should be plenty for a simple query
    const timeoutId = setTimeout(() => controller.abort(), timeout)
  
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    
    clearTimeout(timeoutId)

    if (response.ok) {
      return await response.json()
    }

    // Don't retry - just return null and let fallback handle it
    return null
  } catch (error: any) {
    // Network error - return null, fallback will try event endpoint
    return null
  }
}

// Fetch event data on the server (fallback when invite endpoint fails)
async function fetchEventData(slug: string): Promise<Event | null> {
    const apiBase = getApiBase()
  const url = `${apiBase}/api/registry/${slug}/`
  
  try {
    const controller = new AbortController()
    const timeout = 5000 // 5 seconds max
    const timeoutId = setTimeout(() => controller.abort(), timeout)
  
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    
    clearTimeout(timeoutId)

    if (response.ok) {
      return await response.json()
    }

    return null
  } catch (error: any) {
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
  params,
  searchParams
}: { 
  params: { slug: string }
  searchParams: { g?: string }
}) {
  try {
    // Fetch invite page data (supports guest token via ?g= parameter)
    let inviteData: any = null
    try {
      inviteData = await fetchInviteData(params.slug, searchParams.g)
    } catch (error) {
      // Silently fail - will use fallback
    }
    
    // Extract event data - always use registry endpoint for full event data
    // The invite endpoint only returns invite config, not full event details
    let event: Event | null = null
    try {
      event = await fetchEventData(params.slug)
      
      // If we have invite data, merge the invite-specific config
      if (inviteData && event) {
        // Prefer invite page config over event page_config
        if (inviteData.config) {
          event.page_config = inviteData.config
        }
        // Prefer invite background_url if available
        if (inviteData.background_url) {
          event.banner_image = inviteData.background_url
        }
      }
    } catch (error) {
      // If both fail, event will be null and we'll show 404
      console.error('[InvitePage SSR] Error fetching event data:', error)
    }

  // If event not found, render error page
  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">♻️</div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            This invite has vanished like paper in a recycling bin
          </h1>
          <p className="text-gray-600 mb-2">
            Double-check the link and try again.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Event: {params.slug}
          </p>
        </div>
      </div>
    )
  }

  // Prepare initial config if event data is available
  let initialConfig: InviteConfig | null = null
  // Check if page_config exists and has meaningful content (not just empty object)
  const pageConfig = event.page_config
  const hasValidConfig = pageConfig && 
    typeof pageConfig === 'object' && 
    Object.keys(pageConfig).length > 0 &&
    (pageConfig.tiles || pageConfig.themeId || pageConfig.hero)
  
  if (hasValidConfig && pageConfig) {
    initialConfig = {
      ...pageConfig,
      // Ensure themeId is set if it's missing (required by InviteConfig)
      themeId: pageConfig.themeId || 'classic-noir',
      customColors: pageConfig.customColors !== undefined 
        ? pageConfig.customColors 
        : undefined,
    } as InviteConfig
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

    // Extract allowed_sub_events from invite data
    const allowedSubEvents = inviteData?.allowed_sub_events || []
    

    // Render client component with SSR content
    return (
      <InvitePageClient
        slug={params.slug}
        initialEvent={event}
        initialConfig={initialConfig}
        heroSSR={heroSSR}
        eventDetailsSSR={eventDetailsSSR}
        allowedSubEvents={allowedSubEvents}
      />
    )
  } catch (error: any) {
    // Catch any unexpected errors during SSR and show error page
    console.error('[InvitePage SSR] Unexpected error:', error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-2">
            We encountered an error loading this page.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Event: {params.slug}
          </p>
        </div>
      </div>
    )
  }
}
