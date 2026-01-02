'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
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
  allowedSubEvents?: any[]
}

export default function InvitePageClient({ 
  slug, 
  initialEvent = null, 
  initialConfig = null,
  heroSSR = null,
  eventDetailsSSR = null,
  allowedSubEvents = [],
}: InvitePageClientProps) {
  const [event, setEvent] = useState<Event | null>(initialEvent)
  const [config, setConfig] = useState<InviteConfig | null>(initialConfig)
  const [loading, setLoading] = useState(!initialConfig)
  const [subEvents, setSubEvents] = useState<any[]>(allowedSubEvents)
  const [error, setError] = useState<any>(null)
  

  const fetchInvite = useCallback(async () => {
    try {
      // CRITICAL: Always use slug, never event ID for public invite pages
      // The public endpoint is /api/events/invite/{slug}/, NOT /api/events/{id}/invite/
      if (!slug || typeof slug !== 'string') {
        console.error('[InvitePageClient] Invalid slug:', slug)
        throw new Error('Invalid slug provided')
      }
      
      // Extract guest token from URL
      const urlParams = new URLSearchParams(window.location.search)
      const guestToken = urlParams.get('g')
      
      // ALWAYS use the public invite endpoint with slug (never event ID)
      const inviteUrl = guestToken 
        ? `/api/events/invite/${slug}/?g=${encodeURIComponent(guestToken)}`
        : `/api/events/invite/${slug}/`
      
      // Validate URL format - must use /api/events/invite/{slug}/ pattern
      if (!inviteUrl.startsWith('/api/events/invite/')) {
        console.error('[InvitePageClient] Invalid invite URL format:', inviteUrl)
        throw new Error('Invalid invite URL format - must use /api/events/invite/{slug}/')
      }
      
      console.log('[InvitePageClient] Fetching invite data:', {
        slug,
        inviteUrl,
        apiBase: api.defaults.baseURL,
        fullUrl: `${api.defaults.baseURL}${inviteUrl}`,
        guestToken: guestToken ? 'present' : 'none',
      })
      
      const response = await api.get(inviteUrl)
      const inviteData = response.data
      
      // Extract event data and allowed_sub_events
      const eventData = {
        ...inviteData,
        page_config: inviteData.config,
      }
      
      if (inviteData.allowed_sub_events) {
        setSubEvents(inviteData.allowed_sub_events)
      }

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
      // Capture FULL error details for display
      const fullErrorDetails = {
        type: 'CLIENT_FETCH_ERROR',
        message: error.message,
        name: error.name,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestUrl: error.config?.url,
        requestBaseURL: error.config?.baseURL,
        fullUrl: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
        apiBase: api.defaults.baseURL,
        slug,
        stack: error.stack,
        headers: error.response?.headers,
      }
      
      console.error('[InvitePageClient] Failed to fetch invite:', fullErrorDetails)
      logError('Failed to fetch invite:', error)
      
      // Set error state with full details
      setError(fullErrorDetails)
      setLoading(false)
      
      // If connection error, try fallback to registry endpoint
      if (error.code === 'ERR_CONNECTION_RESET' || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        console.log('[InvitePageClient] Connection error, trying fallback to registry endpoint')
        try {
          const fallbackResponse = await api.get(`/api/registry/${slug}/`)
          const eventData = {
            ...fallbackResponse.data,
            page_config: fallbackResponse.data.page_config,
          }
          
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
          setError(null) // Clear error on successful fallback
          setLoading(false)
          return
        } catch (fallbackError: any) {
          console.error('[InvitePageClient] Fallback also failed:', fallbackError)
          // Update error with fallback failure
          setError({
            ...fullErrorDetails,
            fallbackError: {
              message: fallbackError.message,
              code: fallbackError.code,
              status: fallbackError.response?.status,
            },
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    // If we have initial data from server, skip fetching
    if (initialConfig) {
      return
    }
    
    fetchInvite()
  }, [slug, initialConfig, fetchInvite])

  // Compute backgroundColor early (before early returns) so we can use it in useEffect
  const backgroundColor = config?.customColors?.backgroundColor || '#ffffff'

  // Set body background to match page background
  // This MUST be called before any early returns to follow React hooks rules
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

  // Display error with full details
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center px-4 max-w-6xl w-full">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-6">
            Error Loading Invite Page (Client)
          </h1>
          
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-4 text-left">
            <h2 className="text-xl font-bold text-red-900 mb-3">Full Error Details</h2>
            <pre className="text-red-800 text-sm whitespace-pre-wrap break-words bg-white p-4 rounded border border-red-200 overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
          
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 text-left">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Debug Information</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Slug:</strong> {slug}</p>
              <p><strong>API Base:</strong> {api.defaults.baseURL || 'Not set'}</p>
              <p><strong>Initial Config:</strong> {initialConfig ? 'Yes' : 'No'}</p>
              <p><strong>Initial Event:</strong> {initialEvent ? 'Yes' : 'No'}</p>
              <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    )
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
        allowedSubEvents={subEvents}
    />
    </div>
  )
}

