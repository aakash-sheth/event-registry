'use client'

import { useEffect, useState } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import { DEMO } from '@/lib/invite/loadConfig'
import { logError, logDebug } from '@/lib/error-handler'
import api from '@/lib/api'

interface Event {
  id: number
  title: string
  date?: string
  page_config?: InviteConfig
  has_rsvp?: boolean
  has_registry?: boolean
}

interface InvitePageClientProps {
  slug: string
  initialEvent?: Event | null
  initialConfig?: InviteConfig | null
}

export default function InvitePageClient({ 
  slug, 
  initialEvent = null, 
  initialConfig = null 
}: InvitePageClientProps) {
  const [event, setEvent] = useState<Event | null>(initialEvent)
  const [config, setConfig] = useState<InviteConfig | null>(initialConfig)
  const [loading, setLoading] = useState(!initialConfig)

  useEffect(() => {
    // If we have initial data from server, skip fetching
    if (initialConfig) {
      return
    }
    
    fetchInvite()
  }, [slug])

  const fetchInvite = async () => {
    try {
      // Try to fetch from API
      const response = await api.get(`/api/registry/${slug}/`)
      const eventData = response.data

      if (eventData?.page_config) {
        // Use page_config from API (supports both legacy hero-based and new tile-based configs)
        // Ensure customColors is preserved even if it's an empty object
        const configWithCustomColors = {
          ...eventData.page_config,
          customColors: eventData.page_config.customColors || undefined,
        }
        
        // Debug: Log image tile settings when loading public page
        const imageTile = configWithCustomColors.tiles?.find((t: any) => t.type === 'image')
        if (imageTile) {
          logDebug('[Public Invite Page] Image tile loaded')
        }
        
        setEvent(eventData)
        setConfig(configWithCustomColors)
      } else {
        // Fallback: create config from event data
        const fallbackConfig: InviteConfig = {
          themeId: 'classic-noir',
          hero: {
            title: eventData.title || 'Event',
            subtitle: eventData.description ? eventData.description.substring(0, 100) : undefined,
            showTimer: !!eventData.date,
            eventDate: eventData.date,
            buttons: [
              { label: 'Save the Date', action: 'calendar' },
              ...(eventData.has_rsvp
                ? [{ label: 'RSVP' as const, action: 'rsvp' as const, href: `/event/${slug}/rsvp` }]
                : []),
              ...(eventData.has_registry
                ? [{ label: 'Registry' as const, action: 'registry' as const, href: `/registry/${slug}` }]
                : []),
            ],
          },
          descriptionMarkdown: eventData.description || undefined,
        }
        setEvent(eventData)
        setConfig(fallbackConfig)
      }
    } catch (error: any) {
      logError('Failed to fetch invite:', error)
      // For demo route, use DEMO config
      if (slug === 'aakash-alisha') {
        setConfig(DEMO)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 text-lg">Invitation not found</p>
        </div>
      </div>
    )
  }

  return (
    <LivingPosterPage
      config={config}
      eventSlug={slug}
      eventDate={event?.date}
      hasRsvp={event?.has_rsvp}
      hasRegistry={event?.has_registry}
    />
  )
}

