import { Metadata } from 'next'
import InvitePageClient from './InvitePageClient'
import { InviteConfig } from '@/lib/invite/schema'

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

// Fetch event data on the server
async function fetchEventData(slug: string): Promise<Event | null> {
  try {
    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/registry/${slug}/`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 1 minute to reduce API calls
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch event data for metadata:', error)
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

  if (!event) {
    return {
      title: 'Event Invitation',
      description: 'Join us for a special celebration',
    }
  }

  // Extract banner image from page_config or use banner_image
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

  // Extract title from page_config or use event title
  let title = event.title || 'Event Invitation'
  if (event.page_config?.tiles) {
    const titleTile = event.page_config.tiles.find(
      (tile: any) => tile.type === 'title' && tile.settings?.text
    ) as any
    if (titleTile?.settings?.text) {
      title = titleTile.settings.text
    }
  }

  // Extract description
  let description = event.description || 'Join us for a special celebration'
  if (event.page_config?.tiles) {
    const descTile = event.page_config.tiles.find(
      (tile: any) => tile.type === 'description' && tile.settings?.content
    ) as any
    if (descTile?.settings?.content) {
      // Strip HTML tags for description
      description = descTile.settings.content.replace(/<[^>]*>/g, '').substring(0, 200)
    }
  }

  // Ensure banner image URL is absolute for Open Graph
  let absoluteBannerImage: string | undefined = bannerImage
  if (bannerImage && !bannerImage.startsWith('http://') && !bannerImage.startsWith('https://')) {
    // If relative URL, make it absolute using API base (which should be the frontend URL)
    const apiBase = getApiBase()
    // Remove /api suffix if present
    const baseUrl = apiBase.replace('/api', '')
    absoluteBannerImage = bannerImage.startsWith('/') 
      ? `${baseUrl}${bannerImage}`
      : `${baseUrl}/${bannerImage}`
  }

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(absoluteBannerImage && { images: [{ url: absoluteBannerImage, alt: title }] }),
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
  // If fetch fails (e.g., backend not running in dev), let client component handle it
  const event = await fetchEventData(params.slug)

  // Prepare initial config if event data is available
  let initialConfig: InviteConfig | null = null
  if (event) {
    if (event.page_config) {
      initialConfig = {
        ...event.page_config,
        customColors: event.page_config.customColors || undefined,
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
  }

  // Always render client component - it will handle fetching if server fetch failed
  // This is especially important for local development where backend might not be running
  return (
    <InvitePageClient
      slug={params.slug}
      initialEvent={event || null}
      initialConfig={initialConfig}
    />
  )
}
