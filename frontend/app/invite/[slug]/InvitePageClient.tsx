'use client'

import React, { useEffect, useState } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import { DEMO } from '@/lib/invite/loadConfig'
import { logError, logDebug } from '@/lib/error-handler'
import api from '@/lib/api'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'

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
  heroSSR?: React.ReactNode
  eventDetailsSSR?: React.ReactNode
}

export default function InvitePageClient({ 
  slug, 
  initialEvent = null, 
  initialConfig = null,
  heroSSR = null,
  eventDetailsSSR = null,
}: InvitePageClientProps) {
  const [event, setEvent] = useState<Event | null>(initialEvent)
  const [config, setConfig] = useState<InviteConfig | null>(initialConfig)
  const [loading, setLoading] = useState(!initialConfig)

  // Debug: Log initial config from server

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
        // Preserve customColors - check if it's an object and has properties
        let customColors = undefined
        if (eventData.page_config.customColors !== undefined) {
          // If customColors exists, use it (even if empty object)
          if (typeof eventData.page_config.customColors === 'object' && eventData.page_config.customColors !== null) {
            customColors = eventData.page_config.customColors
          } else {
            customColors = eventData.page_config.customColors
          }
        }
        
        const configWithCustomColors = {
          ...eventData.page_config,
          customColors,
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

  const backgroundColor = config.customColors?.backgroundColor || '#ffffff'

  // Set body background to match page background
  useEffect(() => {
    document.body.style.setProperty('background-color', backgroundColor, 'important')
    document.documentElement.style.setProperty('background-color', backgroundColor, 'important')
    document.body.style.setProperty('background', backgroundColor, 'important')
    document.documentElement.style.setProperty('background', backgroundColor, 'important')

    return () => {
      document.body.style.removeProperty('background-color')
      document.body.style.removeProperty('background')
      document.documentElement.style.removeProperty('background-color')
      document.documentElement.style.removeProperty('background')
    }
  }, [backgroundColor])

  // If we have SSR content, filter out those tiles from config
  const configForClient = heroSSR || eventDetailsSSR ? {
    ...config,
    tiles: config.tiles?.filter((tile) => {
      // Skip image tile if heroSSR is provided
      if (heroSSR && tile.type === 'image') {
        return false
      }
      // Skip title tile if it's overlaying on image (heroSSR handles it)
      if (heroSSR && tile.type === 'title' && tile.overlayTargetId) {
        return false
      }
      // Skip event-details tile if eventDetailsSSR is provided
      if (eventDetailsSSR && tile.type === 'event-details') {
        return false
      }
      return true
    }) || []
  } : config

  return (
    <div className="min-h-screen w-full h-full relative" style={{ backgroundColor, background: backgroundColor } as React.CSSProperties}>
      {/* Texture overlay at page level */}
      <TextureOverlay 
        type={config.texture?.type || 'none'} 
        intensity={config.texture?.intensity || 40} 
      />
      
      {/* Server-rendered hero section */}
      {heroSSR}
      
      {/* Server-rendered event details */}
      {eventDetailsSSR}
      
      {/* Client-rendered remaining tiles */}
      <LivingPosterPage
        config={configForClient}
        eventSlug={slug}
        eventDate={event?.date}
        hasRsvp={event?.has_rsvp}
        hasRegistry={event?.has_registry}
        skipTextureOverlay={true}
        skipBackgroundColor={true}
      />
    </div>
  )
}

