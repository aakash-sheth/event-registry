'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import { logError, logDebug } from '@/lib/error-handler'
import api from '@/lib/api'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'
import EnvelopeAnimation from '@/components/invite/EnvelopeAnimation'

// Helper for development-only logging
const isDev = process.env.NODE_ENV === 'development'
const devLog = (...args: any[]) => {
  if (isDev) console.log(...args)
}

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
  titleSSR?: React.ReactNode
  eventDetailsSSR?: React.ReactNode
  allowedSubEvents?: any[]
}

export default function InvitePageClient({ 
  slug, 
  initialEvent = null, 
  initialConfig = null,
  heroSSR = null,
  titleSSR = null,
  eventDetailsSSR = null,
  allowedSubEvents = [],
}: InvitePageClientProps) {
  // Client-side lifecycle tracking
  const clientStartTime = typeof window !== 'undefined' ? Date.now() : 0
  
  // Log component mount/hydration
  if (typeof window !== 'undefined') {
    devLog('[InvitePageClient] ====== CLIENT COMPONENT MOUNT ======', {
      timestamp: new Date().toISOString(),
      slug,
      hasInitialEvent: !!initialEvent,
      hasInitialConfig: !!initialConfig,
      hasHeroSSR: !!heroSSR,
      hasEventDetailsSSR: !!eventDetailsSSR,
      allowedSubEventsCount: allowedSubEvents.length,
      windowLocation: window.location.href,
    })
  }
  
  const [event, setEvent] = useState<Event | null>(initialEvent)
  const [config, setConfig] = useState<InviteConfig | null>(initialConfig)
  const [loading, setLoading] = useState(!initialConfig)
  const [subEvents, setSubEvents] = useState<any[]>(allowedSubEvents)
  const [error, setError] = useState<any>(null)
  
  // Always show animation on initial load (EnvelopeAnimation component will check sessionStorage)
  // Animation should be the FIRST thing users see
  const [showEnvelopeAnimation, setShowEnvelopeAnimation] = useState(true)
  
  // Log initial state
  if (typeof window !== 'undefined') {
    devLog('[InvitePageClient] 📦 STATE: Initial state set', {
      slug,
      hasEvent: !!event,
      hasConfig: !!config,
      loading,
      subEventsCount: subEvents.length,
    })
  }

  const fetchInvite = useCallback(async () => {
    const fetchStartTime = Date.now()
    devLog('[InvitePageClient] 📡 CLIENT COMMUNICATION: Starting client-side fetch', {
      slug,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: fetchStartTime - clientStartTime,
    })
    try {
      // CRITICAL: Always use slug, never event ID for public invite pages
      // The public endpoint is /api/events/invite/{slug}/, NOT /api/events/{id}/invite/
      if (!slug || typeof slug !== 'string') {
        console.error('[InvitePageClient] Invalid slug:', slug)
        throw new Error('Invalid slug provided')
      }
      
      // Extract guest token and preview flag from URL
      const urlParams = new URLSearchParams(window.location.search)
      const guestToken = urlParams.get('g')
      const isPreview = urlParams.get('preview') === 'true'
      
      // Build query parameters
      const queryParams = new URLSearchParams()
      if (guestToken) {
        queryParams.append('g', guestToken)
      }
      if (isPreview) {
        queryParams.append('preview', 'true')
      }
      const queryString = queryParams.toString()
      
      // ALWAYS use the public invite endpoint with slug (never event ID)
      const inviteUrl = queryString
        ? `/api/events/invite/${slug}/?${queryString}`
        : `/api/events/invite/${slug}/`
      
      // Validate URL format - must use /api/events/invite/{slug}/ pattern
      if (!inviteUrl.startsWith('/api/events/invite/')) {
        console.error('[InvitePageClient] Invalid invite URL format:', inviteUrl)
        throw new Error('Invalid invite URL format - must use /api/events/invite/{slug}/')
      }
      
      devLog('[InvitePageClient] 📡 CLIENT COMMUNICATION: Fetching invite data', {
        slug,
        inviteUrl,
        apiBase: api.defaults.baseURL,
        fullUrl: `${api.defaults.baseURL}${inviteUrl}`,
        guestToken: guestToken ? 'present' : 'none',
        timestamp: new Date().toISOString(),
      })
      
      const apiCallStart = Date.now()
      const response = await api.get(inviteUrl)
      const apiCallEnd = Date.now()
      const inviteData = response.data
      
      devLog('[InvitePageClient] ✅ CLIENT COMMUNICATION: API call succeeded', {
        slug,
        duration: `${apiCallEnd - apiCallStart}ms`,
        dataSize: JSON.stringify(inviteData).length,
        status: response.status,
      })
      
      // Extract event data and allowed_sub_events
      const dataProcessingStart = Date.now()
      devLog('[InvitePageClient] 🔄 CLIENT DATA PROCESSING: Processing response data', {
        slug,
        timestamp: new Date().toISOString(),
      })
      
      const eventData = {
        ...inviteData,
        page_config: inviteData.config,
      }
      
      if (inviteData.allowed_sub_events) {
        setSubEvents(inviteData.allowed_sub_events)
        devLog('[InvitePageClient] ✅ CLIENT DATA PROCESSING: Sub-events set', {
          slug,
          subEventsCount: inviteData.allowed_sub_events.length,
        })
      }

      if (eventData?.page_config) {
        devLog('[InvitePageClient] 🔄 CLIENT DATA PROCESSING: Processing page config', {
          slug,
          hasConfig: !!eventData.page_config,
        })
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
        
        const dataProcessingEnd = Date.now()
        devLog('[InvitePageClient] ✅ CLIENT DATA PROCESSING: Config processed and state updated', {
          slug,
          duration: `${dataProcessingEnd - dataProcessingStart}ms`,
          totalFetchDuration: `${dataProcessingEnd - fetchStartTime}ms`,
        })
        setLoading(false)
      } else {
        devLog('[InvitePageClient] ⚠️ CLIENT DATA PROCESSING: No page config, using fallback', {
          slug,
        })
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
        
        const dataProcessingEnd = Date.now()
        devLog('[InvitePageClient] ✅ CLIENT DATA PROCESSING: Fallback config created and state updated', {
          slug,
          duration: `${dataProcessingEnd - dataProcessingStart}ms`,
          totalFetchDuration: `${dataProcessingEnd - fetchStartTime}ms`,
        })
        setLoading(false)
      }
    } catch (error: any) {
      const fetchEndTime = Date.now()
      console.error('[InvitePageClient] ❌ CLIENT COMMUNICATION: API call failed', {
        slug,
        duration: `${fetchEndTime - fetchStartTime}ms`,
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString(),
      })
      
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
      
      // TEMPORARILY COMMENTED OUT: Fallback to registry endpoint
      // We want to see the main error, not try fallbacks
      /*
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
      */
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const effectStartTime = Date.now()
    devLog('[InvitePageClient] 🔄 CLIENT EFFECT: useEffect triggered (data fetch check)', {
      slug,
      hasInitialConfig: !!initialConfig,
      hasInitialEvent: !!initialEvent,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: effectStartTime - clientStartTime,
    })
    
    // If we have initial data from server (either config or event), skip fetching
    if (initialConfig || initialEvent) {
      devLog('[InvitePageClient] ✅ CLIENT EFFECT: Skipping fetch (has initial data from SSR)', {
        slug,
        hasConfig: !!initialConfig,
        hasEvent: !!initialEvent,
        elapsedSinceMount: Date.now() - clientStartTime,
      })
      return
    }
    
    devLog('[InvitePageClient] 📡 CLIENT EFFECT: No initial data, triggering client-side fetch', {
      slug,
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    fetchInvite()
  }, [slug, initialConfig, initialEvent, fetchInvite])

  // Compute backgroundColor early (before early returns) so we can use it in useEffect
  const backgroundColor = config?.customColors?.backgroundColor || '#ffffff'

  // Set body background to match page background
  // This MUST be called before any early returns to follow React hooks rules
  useEffect(() => {
    devLog('[InvitePageClient] 🎨 CLIENT EFFECT: Setting background color', {
      slug,
      backgroundColor,
      timestamp: new Date().toISOString(),
    })
    
    document.body.style.setProperty('background-color', backgroundColor, 'important')
    document.documentElement.style.setProperty('background-color', backgroundColor, 'important')
    document.body.style.setProperty('background', backgroundColor, 'important')
    document.documentElement.style.setProperty('background', backgroundColor, 'important')
    // Ensure body/html don't force extra height that creates unnecessary scrollbar
    document.body.style.setProperty('min-height', 'auto', 'important')
    document.documentElement.style.setProperty('min-height', 'auto', 'important')

    return () => {
      devLog('[InvitePageClient] 🧹 CLIENT EFFECT: Cleaning up background color', {
        slug,
      })
      document.body.style.removeProperty('background-color')
      document.body.style.removeProperty('background')
      document.body.style.removeProperty('min-height')
      document.documentElement.style.removeProperty('background-color')
      document.documentElement.style.removeProperty('background')
      document.documentElement.style.removeProperty('min-height')
    }
  }, [backgroundColor, slug])

  // Display error
  if (error) {
    devLog('[InvitePageClient] ⚠️ CLIENT RENDER: Rendering error state', {
      slug,
      errorType: error.type,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Unable to load invite page
          </h1>
          <p className="text-gray-600">Please try again later.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    devLog('[InvitePageClient] ⏳ CLIENT RENDER: Rendering loading state', {
      slug,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    
    // Get animation config from initialConfig if available, default to enabled
    const animationEnabled = initialConfig?.animations?.envelope !== false
    
    return (
      <EnvelopeAnimation 
        showAnimation={true}
        enabled={animationEnabled}
        onAnimationComplete={() => {
          devLog('[InvitePageClient] ✨ Envelope animation completed')
        }}
      >
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-4xl mb-4">🌿</div>
            <p className="text-gray-600">Loading invitation...</p>
          </div>
        </div>
      </EnvelopeAnimation>
    )
  }

  if (!config) {
    devLog('[InvitePageClient] ⚠️ CLIENT RENDER: No config available', {
      slug,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 text-lg">Invitation not found</p>
        </div>
      </div>
    )
  }

  // If we have SSR content, filter out those tiles from config
  devLog('[InvitePageClient] 🎨 CLIENT RENDER: Preparing final render', {
    slug,
    hasConfig: !!config,
    hasHeroSSR: !!heroSSR,
    hasEventDetailsSSR: !!eventDetailsSSR,
    tilesCount: config.tiles?.length || 0,
    timestamp: new Date().toISOString(),
    elapsedSinceMount: Date.now() - clientStartTime,
  })
  
  const configForClient = heroSSR || titleSSR || eventDetailsSSR ? {
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
      // Skip standalone title tile if titleSSR is provided
      if (titleSSR && tile.type === 'title' && !tile.overlayTargetId) {
        return false
      }
      // Skip event-details tile if eventDetailsSSR is provided
      if (eventDetailsSSR && tile.type === 'event-details') {
        return false
      }
      return true
    }) || []
  } : config

  const renderTime = Date.now()
  devLog('[InvitePageClient] ✅ CLIENT RENDER: Rendering LivingPosterPage', {
    slug,
    hasConfig: !!configForClient,
    hasHeroSSR: !!heroSSR,
    hasEventDetailsSSR: !!eventDetailsSSR,
    totalElapsed: `${renderTime - clientStartTime}ms`,
    timestamp: new Date().toISOString(),
  })
  
  devLog('[InvitePageClient] ====== CLIENT COMPONENT RENDER COMPLETE ======', {
    slug,
    totalDuration: renderTime - clientStartTime,
    timestamp: new Date().toISOString(),
  })

  // Get animation config, default to enabled
  const animationEnabled = config.animations?.envelope !== false

  return (
    <EnvelopeAnimation 
      showAnimation={showEnvelopeAnimation}
      enabled={animationEnabled}
      onAnimationComplete={() => {
        setShowEnvelopeAnimation(false)
        devLog('[InvitePageClient] ✨ Envelope animation completed')
      }}
    >
      <div className="w-full relative overflow-x-hidden" style={{ backgroundColor, background: backgroundColor, minHeight: 'auto', height: 'auto' } as React.CSSProperties}>
        {/* Texture overlay at page level */}
        <TextureOverlay 
          type={config.texture?.type || 'none'} 
          intensity={config.texture?.intensity || 40} 
        />
        
        {/* Server-rendered hero section */}
        {heroSSR}
        
        {/* Server-rendered standalone title */}
        {titleSSR}
        
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
    </EnvelopeAnimation>
  )
}

