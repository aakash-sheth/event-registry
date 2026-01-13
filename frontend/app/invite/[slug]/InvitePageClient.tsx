'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { InviteConfig } from '@/lib/invite/schema'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import { logError, logDebug } from '@/lib/error-handler'
import api from '@/lib/api'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'
import EnvelopeAnimation from '@/components/invite/EnvelopeAnimation'
import PoweredByBranding from '@/components/invite/PoweredByBranding'

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
  // Extract guest token from URL (most efficient - no state/effects needed)
  const searchParams = useSearchParams()
  const guestToken = searchParams.get('g') || searchParams.get('token')
  
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
  
  // DEBUG: Log initial config order when invite page loads
  useEffect(() => {
    if (initialConfig?.tiles && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[TILE ORDER DEBUG] Invite page initial config order:', {
        tiles: initialConfig.tiles.map(t => ({
          id: t.id,
          type: t.type,
          enabled: t.enabled,
          order: t.order,
          previewOrder: t.previewOrder,
        })),
        enabledTiles: initialConfig.tiles
          .filter(t => t.enabled)
          .sort((a, b) => a.order - b.order)
          .map(t => ({
            id: t.id,
            type: t.type,
            order: t.order,
          })),
      })
    }
  }, [initialConfig])
  
  // Always show animation on initial load (EnvelopeAnimation component will check sessionStorage)
  // Animation should be the FIRST thing users see
  const [showEnvelopeAnimation, setShowEnvelopeAnimation] = useState(true)
  
  // Memoize the animation complete callback to prevent unnecessary re-renders
  // and ensure stable reference for EnvelopeAnimation component
  const handleAnimationComplete = useCallback(() => {
    setShowEnvelopeAnimation(false)
    devLog('[InvitePageClient] ✨ Envelope animation completed')
  }, [])
  
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
      // Add cache-busting headers for preview mode to bypass browser/CDN cache
      // Preview mode should always show latest changes without cache
      const requestConfig: any = {}
      if (isPreview) {
        requestConfig.headers = {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      }
      const response = await api.get(inviteUrl, requestConfig)
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
        
        // Preserve all config properties including pageBorder
        const configWithCustomColors = {
          ...eventData.page_config,
          customColors,
          // Explicitly preserve pageBorder if it exists
          ...(eventData.page_config.pageBorder && { pageBorder: eventData.page_config.pageBorder }),
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

  // Listen for refresh messages using BroadcastChannel (industry standard)
  // This must be after fetchInvite is declared
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if we should listen for updates:
    // 1. Preview mode (always listen)
    // 2. User is authenticated (likely the host viewing their own page)
    const urlParams = new URLSearchParams(window.location.search)
    const isPreview = urlParams.get('preview') === 'true'
    const isAuthenticated = typeof localStorage !== 'undefined' && !!localStorage.getItem('access_token')
    
    // Only listen if in preview mode or user is authenticated (host viewing their page)
    if (!isPreview && !isAuthenticated) {
      return // Guest viewers don't need BroadcastChannel updates (they use polling)
    }
    
    // Use slug-based channel name for targeted updates (industry standard)
    const channelName = `invite-${slug}-updates`
    const channel = new BroadcastChannel(channelName)
    
    const handleMessage = (event: MessageEvent) => {
      // Check if message is to refresh the invite page
      if (event.data?.type === 'REFRESH_INVITE_PAGE' && event.data?.slug === slug) {
        devLog('[InvitePageClient] Received refresh message via BroadcastChannel, reloading data...', {
          slug,
          isPreview,
          isAuthenticated,
        })
        // Force refresh by fetching latest data
        fetchInvite()
      }
    }
    
    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [fetchInvite, slug])

  // Smart polling for guests (industry standard: 30 seconds, only when page visible)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const urlParams = new URLSearchParams(window.location.search)
    const isPreview = urlParams.get('preview') === 'true'
    const isAuthenticated = typeof localStorage !== 'undefined' && !!localStorage.getItem('access_token')
    
    // Don't poll if in preview mode or authenticated (they get BroadcastChannel updates)
    if (isPreview || isAuthenticated) return
    
    // Smart polling (industry standard: 15 seconds for faster updates, only when visible)
    let pollInterval: NodeJS.Timeout | null = null
    let lastCheck = Date.now()
    
    const startPolling = () => {
      if (pollInterval) return // Already polling
      
      // Poll every 15 seconds for faster updates (industry standard: 10-60 seconds)
      pollInterval = setInterval(() => {
        // Only poll if page is visible (saves bandwidth)
        if (document.visibilityState === 'visible') {
          const now = Date.now()
          // Only fetch if it's been at least 15 seconds since last check
          if (now - lastCheck >= 15000) {
            devLog('[InvitePageClient] Polling for updates...')
            fetchInvite()
            lastCheck = now
          }
        }
      }, 15000) // 15 seconds for faster updates
    }
    
    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }
    
    // Start polling when page is visible
    if (document.visibilityState === 'visible') {
      startPolling()
    }
    
    // Handle visibility changes (industry standard)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchInvite, slug])

  // Compute backgroundColor early (before early returns) so we can use it in useEffect
  const backgroundColor = config?.customColors?.backgroundColor || '#ffffff'

  // Set body background to match page background
  // This MUST be called before any early returns to follow React hooks rules
  useEffect(() => {
    devLog('[InvitePageClient] 🎨 CLIENT EFFECT: Setting background color', {
      slug,
      backgroundColor,
      hasBorder: config?.pageBorder?.enabled,
      timestamp: new Date().toISOString(),
    })
    
    // If border is enabled, use a contrasting color for body background so border is visible
    // Otherwise use the page background color
    const bodyBackgroundColor = config?.pageBorder?.enabled 
      ? '#f5f5f5' // Light gray to make border visible
      : backgroundColor
    
    document.body.style.setProperty('background-color', bodyBackgroundColor, 'important')
    document.documentElement.style.setProperty('background-color', bodyBackgroundColor, 'important')
    document.body.style.setProperty('background', bodyBackgroundColor, 'important')
    document.documentElement.style.setProperty('background', bodyBackgroundColor, 'important')
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
  }, [backgroundColor, slug, config?.pageBorder?.enabled])

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
        onAnimationComplete={handleAnimationComplete}
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
  
  const configForClient = heroSSR ? {
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
      // Don't skip standalone title or event-details - let them render client-side in correct order
      return true
    }) || []
  } : config
  
  // DEBUG: Log filtered config after SSR filtering
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[TILE ORDER DEBUG] Config after SSR filtering:', {
      hasHeroSSR: !!heroSSR,
      hasTitleSSR: !!titleSSR,
      hasEventDetailsSSR: !!eventDetailsSSR,
      originalTilesCount: config.tiles?.length || 0,
      filteredTilesCount: configForClient.tiles?.length || 0,
      filteredTiles: configForClient.tiles?.map(t => ({
        id: t.id,
        type: t.type,
        enabled: t.enabled,
        order: t.order,
      })),
      removedTiles: config.tiles?.filter(t => {
        if (heroSSR && t.type === 'image') return true
        if (heroSSR && t.type === 'title' && t.overlayTargetId) return true
        if (titleSSR && t.type === 'title' && !t.overlayTargetId) return true
        if (eventDetailsSSR && t.type === 'event-details') return true
        return false
      }).map(t => ({
        id: t.id,
        type: t.type,
        enabled: t.enabled,
        order: t.order,
        reason: heroSSR && t.type === 'image' ? 'heroSSR' :
                heroSSR && t.type === 'title' && t.overlayTargetId ? 'overlayTitleSSR' :
                titleSSR && t.type === 'title' && !t.overlayTargetId ? 'titleSSR' :
                eventDetailsSSR && t.type === 'event-details' ? 'eventDetailsSSR' : 'unknown'
      })),
    })
  }

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

  // Get page border styles
  const getPageBorderStyle = () => {
    // Debug: Always log pageBorder config
    devLog('[InvitePageClient] 🎨 Page Border Check', {
      hasPageBorder: !!config?.pageBorder,
      pageBorder: config?.pageBorder,
      enabled: config?.pageBorder?.enabled,
      fullConfig: config,
    })
    
    
    if (!config.pageBorder?.enabled) {
      return { 
        border: undefined, 
        boxShadow: undefined, 
        outline: undefined,
        outlineOffset: undefined,
        padding: undefined,
      }
    }
    
    const borderStyle = config.pageBorder!.style || 'solid'
    const borderColor = config.pageBorder!.color || '#D1D5DB'
    const borderWidth = config.pageBorder!.width || 2
    const paddingSize = Math.max(borderWidth + 8, 12) // Padding to create space for border
    
    devLog('[InvitePageClient] 🎨 Page Border Enabled - Applying Styles', {
      enabled: config.pageBorder!.enabled,
      style: borderStyle,
      color: borderColor,
      width: borderWidth,
      paddingSize,
    })
    
    // For intaglio (decorative), use a special pattern with box-shadow
    if (borderStyle === 'intaglio') {
      return {
        border: undefined,
        boxShadow: `inset 0 0 0 ${borderWidth}px ${borderColor}, inset 0 0 0 ${borderWidth * 2}px transparent, inset 0 0 0 ${borderWidth * 3}px ${borderColor}`,
        outline: undefined,
        outlineOffset: undefined,
        padding: `${paddingSize}px`,
      }
    }
    
    // For standard CSS border styles, use border with padding
    // Note: outline doesn't support all border styles, so we use border
    return {
      border: `${borderWidth}px ${borderStyle} ${borderColor}`,
      boxShadow: undefined,
      outline: undefined,
      outlineOffset: undefined,
      padding: `${paddingSize}px`,
    }
  }

  const borderStyle = getPageBorderStyle()
  const hasBorder = config?.pageBorder?.enabled

  return (
    <EnvelopeAnimation 
      showAnimation={showEnvelopeAnimation}
      enabled={animationEnabled}
      onAnimationComplete={handleAnimationComplete}
    >
      {hasBorder ? (
        // Container with border and padding
        <div 
          className="relative w-full min-h-screen"
          style={{
            backgroundColor: '#f5f5f5', // Light gray background to show border
            padding: borderStyle.padding,
          } as React.CSSProperties}
        >
          <div 
            className="relative overflow-x-hidden w-full"
            style={{ 
              backgroundColor, 
              background: backgroundColor, 
              minHeight: '100vh', 
              height: 'auto',
              border: borderStyle.border,
              boxShadow: borderStyle.boxShadow,
              outline: borderStyle.outline,
              outlineOffset: borderStyle.outlineOffset,
            } as React.CSSProperties}
          >
            {/* Texture overlay at page level */}
            <TextureOverlay 
              type={config.texture?.type || 'none'} 
              intensity={config.texture?.intensity || 40} 
            />
            
            {/* Server-rendered hero section (image with overlay title for SEO) */}
            {heroSSR}
            
            {/* All other tiles (including title and event-details) render client-side in correct order */}
            <LivingPosterPage
              config={configForClient}
              eventSlug={slug}
              eventDate={event?.date}
              hasRsvp={event?.has_rsvp}
              hasRegistry={event?.has_registry}
              skipTextureOverlay={true}
              skipBackgroundColor={true}
              allowedSubEvents={subEvents}
              guestToken={guestToken}
            />
            
            {/* Branding component at the bottom */}
            <PoweredByBranding />
          </div>
        </div>
      ) : (
        // No border - original structure
        <div 
          className="w-full relative overflow-x-hidden"
          style={{ 
            backgroundColor, 
            background: backgroundColor, 
            minHeight: 'auto', 
            height: 'auto',
          } as React.CSSProperties}
        >
          {/* Texture overlay at page level */}
          <TextureOverlay 
            type={config.texture?.type || 'none'} 
            intensity={config.texture?.intensity || 40} 
          />
          
          {/* Server-rendered hero section (image with overlay title for SEO) */}
          {heroSSR}
          
          {/* All other tiles (including title and event-details) render client-side in correct order */}
          <LivingPosterPage
            config={configForClient}
            eventSlug={slug}
            eventDate={event?.date}
            hasRsvp={event?.has_rsvp}
            hasRegistry={event?.has_registry}
            skipTextureOverlay={true}
            skipBackgroundColor={true}
            allowedSubEvents={subEvents}
            guestToken={guestToken}
          />
          
          {/* Branding component at the bottom */}
          <PoweredByBranding />
        </div>
      )}
    </EnvelopeAnimation>
  )
}

