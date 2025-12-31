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
// Retries on network errors or 5xx status codes
async function fetchInviteData(slug: string, guestToken?: string, retries: number = 2): Promise<any | null> {
  const apiBase = getApiBase()
  const url = guestToken 
    ? `${apiBase}/api/events/invite/${slug}/?g=${encodeURIComponent(guestToken)}`
    : `${apiBase}/api/events/invite/${slug}/`
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      // Increased timeout: 10 seconds for production (was 3 seconds)
      const timeout = process.env.NODE_ENV === 'production' ? 10000 : 3000
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        // Use cache: 'no-store' for development, or next: { revalidate } for production
        ...(process.env.NODE_ENV === 'development' 
          ? { cache: 'no-store' as RequestCache }
          : { next: { revalidate: 3600 } }
        ),
      })
      
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        if (attempt > 0) {
          console.log(`[InvitePage SSR] Successfully fetched invite data for ${slug} on attempt ${attempt + 1}`)
        }
        return data
      }

      // Log the error for debugging
      const errorText = await response.text().catch(() => 'Unable to read error response')
      const status = response.status
      
      // Don't retry on 4xx errors (client errors) - these are permanent
      if (status >= 400 && status < 500) {
        console.error(`[InvitePage SSR] Client error fetching invite data for ${slug}:`, {
          status,
          statusText: response.statusText,
          url,
          error: errorText.substring(0, 200),
        })
        return null
      }

      // Retry on 5xx errors (server errors) or network errors
      if (status >= 500 || attempt < retries) {
        console.warn(`[InvitePage SSR] Server error fetching invite data for ${slug} (attempt ${attempt + 1}/${retries + 1}):`, {
          status,
          statusText: response.statusText,
          url,
        })
        
        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
      }

      // If we get here, it's a 5xx error and we've exhausted retries
      console.error(`[InvitePage SSR] Failed to fetch invite data for ${slug} after ${retries + 1} attempts:`, {
        status,
        statusText: response.statusText,
        url,
        error: errorText.substring(0, 200),
      })
      return null
    } catch (error: any) {
      // Retry on network errors (AbortError is timeout, others are network issues)
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          console.warn(`[InvitePage SSR] Timeout fetching invite data for ${slug} (attempt ${attempt + 1}/${retries + 1}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        } else {
          console.error(`[InvitePage SSR] Timeout fetching invite data for ${slug} after ${retries + 1} attempts`)
        }
      } else {
        if (attempt < retries) {
          console.warn(`[InvitePage SSR] Network error fetching invite data for ${slug} (attempt ${attempt + 1}/${retries + 1}):`, {
            error: error.message,
          })
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        } else {
          console.error('[InvitePage SSR] Network error fetching invite data:', {
            slug,
            guestToken: guestToken ? 'present' : 'none',
            error: error.message,
            stack: error.stack?.substring(0, 200),
          })
        }
      }
      return null
    }
  }
  
  return null
}

// Fetch event data on the server (fallback when invite endpoint fails)
async function fetchEventData(slug: string, retries: number = 1): Promise<Event | null> {
  const apiBase = getApiBase()
  const url = `${apiBase}/api/registry/${slug}/`
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      // Increased timeout: 10 seconds for production
      const timeout = process.env.NODE_ENV === 'production' ? 10000 : 3000
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(url, {
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

      if (response.ok) {
        const data = await response.json()
        return data
      }

      // Don't retry on 4xx errors
      if (response.status >= 400 && response.status < 500) {
        console.error(`[InvitePage SSR] Client error fetching event data for ${slug}:`, {
          status: response.status,
          statusText: response.statusText,
        })
        return null
      }

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < retries) {
        console.warn(`[InvitePage SSR] Server error fetching event data for ${slug} (attempt ${attempt + 1}/${retries + 1}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }

      return null
    } catch (error: any) {
      // Retry on network errors
      if (attempt < retries) {
        if (error.name === 'AbortError') {
          console.warn(`[InvitePage SSR] Timeout fetching event data for ${slug} (attempt ${attempt + 1}/${retries + 1}), retrying...`)
        } else {
          console.warn(`[InvitePage SSR] Network error fetching event data for ${slug} (attempt ${attempt + 1}/${retries + 1}):`, {
            error: error.message,
          })
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }
      
      // Only log non-timeout errors on final attempt
      if (error.name !== 'AbortError') {
        console.error('[InvitePage SSR] Failed to fetch event data:', {
          slug,
          error: error.message,
        })
      }
      return null
    }
  }
  
  return null
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
  // Fetch invite page data (supports guest token via ?g= parameter)
  const inviteData = await fetchInviteData(params.slug, searchParams.g)
  
  // Debug: Log what we got from the API
  if (inviteData) {
    console.log('[InvitePage SSR] inviteData received:', {
      hasAllowedSubEvents: !!inviteData.allowed_sub_events,
      allowedSubEventsCount: inviteData.allowed_sub_events?.length || 0,
      keys: Object.keys(inviteData),
    })
  } else {
    console.log('[InvitePage SSR] inviteData is null, falling back to event data fetch')
  }
  
  // Extract event data from invite response or fallback to event endpoint
  let event: Event | null = null
  
  if (inviteData) {
    // Use data from invite endpoint
    event = {
      id: inviteData.event || 0,
      title: inviteData.event_slug || params.slug,
      date: undefined,
      description: undefined,
      banner_image: inviteData.background_url,
      page_config: inviteData.config,
      has_rsvp: true,
      has_registry: true,
    }
  } else {
    // Fallback: try to get event data from registry endpoint
    // This handles cases where invite page doesn't exist yet but event does
    console.log('[InvitePage SSR] Attempting fallback to event data for slug:', params.slug)
    event = await fetchEventData(params.slug)
    
    if (!event) {
      console.error('[InvitePage SSR] Both invite and event endpoints failed for slug:', params.slug)
    }
  }

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
}
