import { Metadata } from 'next'
import React from 'react'
import InvitePageClient from './InvitePageClient'
import { InviteConfig, Tile } from '@/lib/invite/schema'
import ImageTileSSR from '@/components/invite/tiles/ImageTileSSR'
import TitleTileSSR from '@/components/invite/tiles/TitleTileSSR'
import EventDetailsTileSSR from '@/components/invite/tiles/EventDetailsTileSSR'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'
import http from 'http'
import https from 'https'

// ISR: Revalidate every hour (3600 seconds)
export const revalidate = 3600

// Helper for development-only logging
const isDev = process.env.NODE_ENV === 'development'
const devLog = (...args: any[]) => {
  if (isDev) console.log(...args)
}

// Timing tracker for comprehensive request lifecycle logging
class RequestLifecycleTracker {
  private steps: Map<string, number> = new Map()
  private startTime: number

  constructor() {
    this.startTime = Date.now()
    this.step('INIT', 'Request lifecycle tracker initialized')
  }

  step(name: string, description?: string): number {
    const now = Date.now()
    const elapsed = now - this.startTime
    const previousStep = Array.from(this.steps.entries()).pop()
    const stepDuration = previousStep ? now - previousStep[1] : elapsed

    this.steps.set(name, now)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Lifecycle] STEP: ${name}`, {
        description,
        elapsed: `${elapsed}ms`,
        stepDuration: `${stepDuration}ms`,
        timestamp: new Date().toISOString(),
      })
    }

    return elapsed
  }

  getSummary(): any {
    const summary: any = {
      totalDuration: Date.now() - this.startTime,
      steps: [],
    }

    let prevTime = this.startTime
    const stepsArray = Array.from(this.steps.entries())
    for (const [name, time] of stepsArray) {
      const stepDuration = time - prevTime
      summary.steps.push({
        name,
        timestamp: time,
        duration: stepDuration,
        cumulative: time - this.startTime,
      })
      prevTime = time
    }

    return summary
  }

  logSummary(context: string) {
    const summary = this.getSummary()
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Lifecycle] ${context} - COMPLETE SUMMARY`, summary)
    }
  }
}

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
// Uses NEXT_PUBLIC_API_BASE (set at build time or runtime)
function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
}

// Get frontend URL for absolute URL conversion (for meta tags, images, etc.)
// Uses NEXT_PUBLIC_COMPANY_HOMEPAGE or NEXT_PUBLIC_API_BASE (which should be the frontend URL)
function getFrontendUrl(): string {
  return process.env.NEXT_PUBLIC_COMPANY_HOMEPAGE || process.env.NEXT_PUBLIC_API_BASE || 'https://eventregistry.com'
}

// Fetch invite page data (supports guest token)
// Single attempt - no retries for simple page rendering
async function fetchInviteData(slug: string, guestToken?: string): Promise<any | null> {
    // CRITICAL: Always use slug, never event ID for public invite pages
    // The public endpoint is /api/events/invite/{slug}/, NOT /api/events/{id}/invite/
    if (!slug || typeof slug !== 'string') {
      console.error('[InvitePage SSR] Invalid slug:', slug)
      return null
    }
    
    const apiBase = getApiBase()
    // ALWAYS use the public invite endpoint with slug (never event ID)
    const url = guestToken 
      ? `${apiBase}/api/events/invite/${slug}/?g=${encodeURIComponent(guestToken)}`
      : `${apiBase}/api/events/invite/${slug}/`
    
    // Validate URL format - must use /api/events/invite/{slug}/ pattern
    if (!url.includes('/api/events/invite/')) {
      console.error('[InvitePage SSR] Invalid invite URL format:', url)
      return null
    }
  
    // Detailed logging for diagnosis
    const requestStartTime = Date.now()
    const performanceTimings: any = {
      requestStart: requestStartTime,
      dnsLookup: null,
      tcpConnection: null,
      requestSent: null,
      firstByte: null,
      responseComplete: null,
      totalDuration: null,
    }

    // Log request initiation
    if (process.env.NODE_ENV === 'development') {
      console.log('[InvitePage SSR] Starting fetch request', {
        timestamp: new Date().toISOString(),
        slug,
        url,
        apiBase,
        hasGuestToken: !!guestToken,
        timeout: 15000,
        nodeEnv: process.env.NODE_ENV,
        backendApiBase: process.env.BACKEND_API_BASE || 'NOT SET',
        publicApiBase: process.env.NEXT_PUBLIC_API_BASE || 'NOT SET',
      })
    }

    // Try to resolve DNS (if possible in Node.js environment)
    let dnsResolved = false
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      // In Node.js, we can't easily test DNS without dns module, but we can log the hostname
      if (process.env.NODE_ENV === 'development') {
        console.log('[InvitePage SSR] DNS Info', {
          hostname,
          protocol: urlObj.protocol,
          port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
        })
      }
      dnsResolved = true
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[InvitePage SSR] Could not parse URL for DNS info:', e)
      }
    }

    const dnsTime = Date.now()
    performanceTimings.dnsLookup = dnsTime - requestStartTime

  try {
    const controller = new AbortController()
    // Increase timeout for production (ALB + network latency)
    const timeout = process.env.NODE_ENV === 'production' ? 30000 : 15000 // 30s in prod, 15s in dev
    
    // Log timeout setup
    if (process.env.NODE_ENV === 'development') {
      console.log('[InvitePage SSR] Setting up fetch with timeout', {
        timeout,
        url,
        signalAborted: controller.signal.aborted,
      })
    }

    const timeoutId = setTimeout(() => {
      const elapsed = Date.now() - requestStartTime
      console.error('[InvitePage SSR] ⚠️ TIMEOUT TRIGGERED', {
        elapsed,
        timeout,
        url,
        slug,
        timings: performanceTimings,
        signalAborted: controller.signal.aborted,
      })
      controller.abort()
    }, timeout)
  
    const tcpStartTime = Date.now()
    performanceTimings.tcpConnection = tcpStartTime - dnsTime

    // Log fetch initiation
    if (process.env.NODE_ENV === 'development') {
      console.log('[InvitePage SSR] Initiating fetch', {
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        hasSignal: !!controller.signal,
      })
    }

    const requestSentTime = Date.now()
    performanceTimings.requestSent = requestSentTime - tcpStartTime

    // Use Node's native http/https to bypass Next.js fetch wrapper issues
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http
    const isAborted = { value: false }
    
    // Set up abort handler
    if (controller.signal) {
      controller.signal.addEventListener('abort', () => {
        isAborted.value = true
      })
    }

    const response = await new Promise<any>((resolve, reject) => {
      if (isAborted.value) {
        reject(new Error('Aborted'))
        return
      }

      const req = protocol.request(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: timeout,
      }, (res) => {
        const firstByteTime = Date.now()
        performanceTimings.firstByte = firstByteTime - requestSentTime
    clearTimeout(timeoutId)

        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          const jsonEndTime = Date.now()
          performanceTimings.responseComplete = jsonEndTime - firstByteTime
          performanceTimings.totalDuration = jsonEndTime - requestStartTime

          const statusCode = res.statusCode || 0
          const isSuccess = statusCode >= 200 && statusCode < 300

          // Check if response is HTML (starts with <) - indicates error page
          const isHtml = data.trim().startsWith('<')
          
          // If it's an error status or HTML response, handle it appropriately
          if (!isSuccess || isHtml) {
            const errorDetails = {
              slug,
              url,
              status: statusCode,
              statusMessage: res.statusMessage,
              contentType: res.headers['content-type'] || 'unknown',
              dataPreview: data.substring(0, 200), // First 200 chars for debugging
              dataSize: data.length,
              isHtml,
            }
            
            console.error('[InvitePage SSR] ❌ Error response received', errorDetails)
            
            // If it's HTML, try to extract error message or provide helpful error
            if (isHtml) {
              const errorMsg = statusCode === 404 
                ? `Invite page not found for slug: ${slug}`
                : statusCode === 500
                ? `Server error (500) - backend may be experiencing issues`
                : `Received HTML response instead of JSON (status: ${statusCode})`
              
              reject(new Error(errorMsg))
              return
            }
            
            // If it's not HTML but still an error, try to parse as JSON error response
            try {
              const errorData = JSON.parse(data)
              reject(new Error(errorData.detail || errorData.error || `Request failed with status ${statusCode}`))
            } catch (parseError) {
              reject(new Error(`Request failed with status ${statusCode}: ${res.statusMessage || 'Unknown error'}`))
            }
            return
          }

          // Success response - try to parse JSON
          try {
            const jsonData = JSON.parse(data)
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[InvitePage SSR] ✅ Request successful', {
                slug,
                url,
                status: statusCode,
                statusMessage: res.statusMessage,
                dataSize: data.length,
                totalDuration: performanceTimings.totalDuration,
                timings: performanceTimings,
              })
            }

            resolve({
              ok: true,
              status: statusCode,
              statusText: res.statusMessage,
              json: async () => jsonData,
              data: jsonData,
            })
          } catch (parseError) {
            // Log the actual response for debugging
            console.error('[InvitePage SSR] JSON parse error', {
              error: parseError,
              status: statusCode,
              contentType: res.headers['content-type'],
              dataPreview: data.substring(0, 200),
              dataSize: data.length,
              url,
              slug,
            })
            reject(new Error(`Failed to parse JSON response: ${parseError}. Response may be HTML or invalid JSON.`))
          }
        })
      })

      req.on('error', (error) => {
        clearTimeout(timeoutId)
        const errorDetails = {
          type: 'NETWORK_ERROR',
          message: error.message,
          code: (error as any).code,
          url,
          slug,
          elapsed: Date.now() - requestStartTime,
        }
        console.error('[InvitePage SSR] Request error', errorDetails)
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        clearTimeout(timeoutId)
        const errorDetails = {
          type: 'TIMEOUT',
          message: 'Request timeout - backend did not respond within timeout period',
          url,
          slug,
          elapsed: Date.now() - requestStartTime,
          timeout,
        }
        console.error('[InvitePage SSR] Request timeout', errorDetails)
        reject(new Error(`Request timeout after ${timeout}ms`))
      })

      // Handle abort
      if (controller.signal) {
        controller.signal.addEventListener('abort', () => {
          req.destroy()
          clearTimeout(timeoutId)
          reject(new Error('Aborted'))
        })
      }

      req.end()
    })

    if (response.ok) {
      return response.data || await response.json()
    }

    // Handle error response
    const errorBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || {})
    performanceTimings.totalDuration = Date.now() - requestStartTime

    console.error('[InvitePage SSR] ❌ HTTP Error Response', {
      status: response.status,
      statusText: response.statusText,
      url,
      slug,
      errorBodyLength: errorBody.length,
      errorBodyPreview: errorBody.substring(0, 500),
      totalDuration: performanceTimings.totalDuration,
      timings: performanceTimings,
    })

    const errorDetails = {
      type: 'HTTP_ERROR',
        status: response.status,
        statusText: response.statusText,
      url,
      slug,
      responseBody: errorBody.substring(0, 1000),
      message: `Invite endpoint returned ${response.status} ${response.statusText} for slug: ${slug}`,
      timings: performanceTimings,
    }

    throw new Error(JSON.stringify(errorDetails, null, 2))
  } catch (error: any) {
    const errorTime = Date.now()
    performanceTimings.totalDuration = errorTime - requestStartTime

    // Enhanced error logging
    console.error('[InvitePage SSR] ❌ Fetch Error', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      url,
      slug,
      elapsed: performanceTimings.totalDuration,
      timings: performanceTimings,
      signalAborted: error.name === 'AbortError' ? true : undefined,
      isTimeout: error.name === 'AbortError',
      isNetworkError: error.message?.includes('fetch') || error.message?.includes('network'),
      errorType: error.constructor?.name,
    })

    // Re-throw with enhanced error details
    if (error.name === 'AbortError') {
      const timeoutError = {
        type: 'TIMEOUT_ERROR',
        message: `Request timeout after 15 seconds`,
        url,
        slug,
        errorName: error.name,
        elapsed: performanceTimings.totalDuration,
        timings: performanceTimings,
        dnsResolved,
        apiBase,
        backendApiBase: process.env.BACKEND_API_BASE || 'NOT SET',
        publicApiBase: process.env.NEXT_PUBLIC_API_BASE || 'NOT SET',
      }
      console.error('[InvitePage SSR] ⚠️ TIMEOUT ERROR DETAILS', timeoutError)
      throw new Error(JSON.stringify(timeoutError, null, 2))
    }
    
    // If already our formatted error, re-throw
    if (error.message && error.message.includes('HTTP_ERROR')) {
      throw error
    }
    
    // Network or other error
    const networkError = {
      type: 'NETWORK_ERROR',
      message: error.message || 'Unknown network error',
      url,
      slug,
      errorName: error.name,
      errorStack: error.stack,
      elapsed: performanceTimings.totalDuration,
      timings: performanceTimings,
      dnsResolved,
      apiBase,
      backendApiBase: process.env.BACKEND_API_BASE || 'NOT SET',
      publicApiBase: process.env.NEXT_PUBLIC_API_BASE || 'NOT SET',
    }
    console.error('[InvitePage SSR] ⚠️ NETWORK ERROR DETAILS', networkError)
    throw new Error(JSON.stringify(networkError, null, 2))
  }
}

// Fetch event data on the server (fallback when invite endpoint fails)
async function fetchEventData(slug: string): Promise<Event | null> {
    const apiBase = getApiBase()
  const url = `${apiBase}/api/registry/${slug}/`
  const requestStartTime = Date.now()
  
  try {
    const controller = new AbortController()
    // Increase timeout for production (ALB + network latency)
    const timeout = process.env.NODE_ENV === 'production' ? 30000 : 15000 // 30s in prod, 15s in dev
    const timeoutId = setTimeout(() => controller.abort(), timeout)
  
    // Use Node's native http/https to bypass Next.js fetch wrapper issues
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http
    const isAborted = { value: false }
    
    if (controller.signal) {
      controller.signal.addEventListener('abort', () => {
        isAborted.value = true
      })
    }

    const response = await new Promise<any>((resolve, reject) => {
      if (isAborted.value) {
        reject(new Error('Aborted'))
        return
      }

      const req = protocol.request(url, {
        method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
        timeout: timeout,
      }, (res) => {
        clearTimeout(timeoutId)
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data)
            resolve({
              ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              json: async () => jsonData,
              data: jsonData,
    })
          } catch (parseError) {
            reject(new Error(`Failed to parse JSON: ${parseError}`))
          }
        })
      })

      req.on('error', (error) => {
        clearTimeout(timeoutId)
        const errorDetails = {
          type: 'NETWORK_ERROR',
          message: error.message,
          code: (error as any).code,
          url,
          slug,
          elapsed: Date.now() - requestStartTime,
        }
        console.error('[InvitePage SSR] fetchEventData request error', errorDetails)
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        clearTimeout(timeoutId)
        const errorDetails = {
          type: 'TIMEOUT',
          message: 'Request timeout - backend did not respond within timeout period',
          url,
          slug,
          elapsed: Date.now() - requestStartTime,
          timeout,
        }
        console.error('[InvitePage SSR] fetchEventData request timeout', errorDetails)
        reject(new Error(`Request timeout after ${timeout}ms`))
      })

      if (controller.signal) {
        controller.signal.addEventListener('abort', () => {
          req.destroy()
          clearTimeout(timeoutId)
          reject(new Error('Aborted'))
        })
      }

      req.end()
    })

    if (response.ok) {
      return response.data || await response.json()
    }

    // Get error response body
    const errorBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '')

    const errorDetails = {
      type: 'HTTP_ERROR',
        status: response.status,
        statusText: response.statusText,
      url,
      slug,
      responseBody: errorBody.substring(0, 1000),
      message: `Registry endpoint returned ${response.status} ${response.statusText} for slug: ${slug}`,
    }

    throw new Error(JSON.stringify(errorDetails, null, 2))
  } catch (error: any) {
    // Re-throw with enhanced error details
    if (error.name === 'AbortError') {
      const timeoutError = {
        type: 'TIMEOUT_ERROR',
        message: `Request timeout after 15 seconds`,
        url,
        slug,
        errorName: error.name,
      }
      throw new Error(JSON.stringify(timeoutError, null, 2))
    }
    
    // If already our formatted error, re-throw
    if (error.message && error.message.includes('HTTP_ERROR')) {
      throw error
    }
    
    // Network or other error
    const networkError = {
      type: 'NETWORK_ERROR',
      message: error.message || 'Unknown network error',
      url,
      slug,
      errorName: error.name,
      errorStack: error.stack,
    }
    throw new Error(JSON.stringify(networkError, null, 2))
  }
}

// Generate metadata for Open Graph and Twitter Cards
export async function generateMetadata({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<Metadata> {
  try {
    const tracker = new RequestLifecycleTracker()
    tracker.step('METADATA_START', 'generateMetadata called')
    
    devLog('[InvitePage Metadata] ====== METADATA GENERATION START ======', {
      slug: params.slug,
      timestamp: new Date().toISOString(),
    })

    const fetchStart = Date.now()
    let event: Event | null = null
    try {
      event = await fetchEventData(params.slug)
    } catch (error: any) {
      console.error('[InvitePage Metadata] Error fetching event data for metadata', {
        slug: params.slug,
        error: error.message,
        errorType: error.name,
      })
      // Continue with null event - will use fallback metadata
    }
    const fetchEnd = Date.now()
    
    tracker.step('METADATA_FETCH_COMPLETE', 'Event data fetched for metadata')
    devLog('[InvitePage Metadata] Event data fetch', {
      slug: params.slug,
      duration: `${fetchEnd - fetchStart}ms`,
      eventFound: !!event,
    })

  // Get frontend URL for absolute URL conversion
  const frontendUrl = getFrontendUrl()
  const baseUrl = frontendUrl.replace('/api', '')
  const pageUrl = `${baseUrl}/invite/${params.slug}`

  if (!event) {
      tracker.step('METADATA_COMPLETE', 'Metadata object created (fallback)')
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

    tracker.step('METADATA_COMPLETE', 'Metadata object created')
    tracker.logSummary('METADATA GENERATION')
    
    devLog('[InvitePage Metadata] ====== METADATA GENERATION COMPLETE ======', {
      slug: params.slug,
      totalDuration: tracker.getSummary().totalDuration,
    })

  return metadata
  } catch (error: any) {
    console.error('[InvitePage Metadata] ❌ ERROR in generateMetadata', {
      slug: params.slug,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    })
    
    // Return fallback metadata on error
    return {
      title: 'Event Invitation',
      description: 'Join us for a special celebration',
      robots: {
        index: false,
        follow: false,
      },
    }
  }
}

// Server component that fetches initial data and renders client component
export default async function InvitePage({ 
  params,
  searchParams
}: { 
  params: { slug: string }
  searchParams: { g?: string }
}) {
  let tracker: RequestLifecycleTracker | null = null
  const startTime = Date.now()
  const slug = params.slug
  
  // Initialize tracker with error handling
  try {
    tracker = new RequestLifecycleTracker()
  } catch (error: any) {
    console.error('[InvitePage SSR] Failed to initialize RequestLifecycleTracker', {
      error: error.message,
      errorType: error.name,
    })
    // Continue without tracker - don't break the page
  }
  
  // STEP 1: Route Entry - Next.js calls this component
  tracker?.step('ROUTE_ENTRY', 'Next.js route handler called')
  console.log('[InvitePage SSR] ====== PAGE RENDER START ======', {
    timestamp: new Date().toISOString(),
        slug,
        hasGuestToken: !!searchParams.g,
    guestToken: searchParams.g ? 'present' : 'none',
    nodeEnv: process.env.NODE_ENV,
        apiBase: getApiBase(),
    backendApiBase: process.env.BACKEND_API_BASE || 'NOT SET',
    publicApiBase: process.env.NEXT_PUBLIC_API_BASE || 'NOT SET',
    processUptime: process.uptime(),
  })

  try {
    // STEP 2: Initialization
    tracker?.step('INIT', 'Component initialization')
    devLog(`[InvitePage SSR] Component initialized for slug: ${slug}`, {
      slug,
      hasGuestToken: !!searchParams.g,
      apiBase: getApiBase(),
    })
    
    // STEP 3: Fetch invite page data (supports guest token via ?g= parameter)
    tracker?.step('FETCH_START', 'Starting backend API call')
    let inviteData: any = null
    let inviteError: any = null
    
    try {
      devLog('[InvitePage SSR] 📡 COMMUNICATION: Initiating backend API call', {
        slug,
        timestamp: new Date().toISOString(),
        apiBase: getApiBase(),
        endpoint: `/api/events/invite/${slug}/`,
        hasGuestToken: !!searchParams.g,
      })
      
      inviteData = await fetchInviteData(slug, searchParams.g)
      
      tracker?.step('FETCH_COMPLETE', 'Backend API call completed successfully')
      devLog('[InvitePage SSR] ✅ COMMUNICATION: Backend API call succeeded', {
        slug,
        hasData: !!inviteData,
        dataSize: inviteData ? JSON.stringify(inviteData).length : 0,
      })
      
      // Log if fetch took too long
      if (tracker) {
        const fetchStep = tracker.getSummary().steps.find((s: any) => s.name === 'FETCH_COMPLETE')
        if (fetchStep && fetchStep.duration > 3000) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[InvitePage SSR] ⚠️ Slow backend communication detected', {
              slug,
              duration: fetchStep.duration,
              threshold: 3000,
            })
          }
        }
      }
    } catch (error: any) {
      tracker?.step('FETCH_ERROR', 'Backend API call failed')
      inviteError = error
      const elapsed = tracker ? tracker.getSummary().steps.find((s: any) => s.name === 'FETCH_ERROR')?.duration || 0 : 0
      console.error(`[InvitePage SSR] ❌ COMMUNICATION: Backend API call failed for slug: ${slug}`, {
        error: error.message,
        errorType: error.name,
        stack: error.stack,
        elapsed,
      })
      // If invite data fetch fails, show error
      if (inviteError) {
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
    }
    
    
    // STEP 4: Data Processing - Transform invite data to event format
    tracker?.step('DATA_PROCESSING_START', 'Processing and transforming data')
    let event: Event | null = null
    
    // Try to construct event from inviteData if it has the necessary fields
    if (inviteData) {
      devLog('[InvitePage SSR] 🔄 DATA PROCESSING: Transforming invite data to event format', {
        slug,
        hasInviteData: !!inviteData,
        inviteDataKeys: inviteData ? Object.keys(inviteData) : [],
      })
      
      // If inviteData has event info, use it
      if (inviteData.event_slug || inviteData.slug) {
        event = {
          id: inviteData.id || 0,
          title: inviteData.title || 'Event',
          date: inviteData.date,
          description: inviteData.description,
          banner_image: inviteData.background_url,
          page_config: inviteData.config,
          has_rsvp: inviteData.has_rsvp,
          has_registry: inviteData.has_registry,
        } as Event
        
        tracker?.step('DATA_PROCESSING_COMPLETE', 'Event object constructed from invite data')
        devLog('[InvitePage SSR] ✅ DATA PROCESSING: Event object created', {
          slug,
          eventId: event.id,
          hasConfig: !!event.page_config,
        })
      } else {
        tracker?.step('DATA_PROCESSING_WARNING', 'Invite data missing event info')
        if (process.env.NODE_ENV === 'development') {
          console.warn('[InvitePage SSR] ⚠️ DATA PROCESSING: Invite data missing event_slug or slug', {
            slug,
            inviteDataKeys: Object.keys(inviteData),
          })
        }
      }
    } else {
      tracker?.step('DATA_PROCESSING_ERROR', 'No invite data to process')
      console.error('[InvitePage SSR] ❌ DATA PROCESSING: No invite data available', {
        slug,
      })
    }

  // STEP 5: Error Handling - If event not found, render error page
  if (!event) {
    tracker?.step('ERROR_RENDER_START', 'Rendering error page')
    devLog('[InvitePage SSR] ⚠️ RENDERING: Error page (event not found)', {
      slug,
      hasInviteData: !!inviteData,
      hasInviteError: !!inviteError,
    })
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Unable to load invite page
          </h1>
          <p className="text-gray-600">The invite page could not be loaded. Please check the URL or contact support.</p>
        </div>
      </div>
    )
  }

  // STEP 6: Config Preparation - Prepare invite configuration
  tracker?.step('CONFIG_PREP_START', 'Preparing invite configuration')
  devLog('[InvitePage SSR] ⚙️ CONFIG: Preparing invite configuration', {
    slug,
    hasPageConfig: !!event.page_config,
  })
  
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
  
  tracker?.step('CONFIG_PREP_COMPLETE', 'Invite configuration prepared')
  devLog('[InvitePage SSR] ✅ CONFIG: Configuration prepared', {
    slug,
    hasConfig: !!initialConfig,
    configType: initialConfig?.themeId || 'fallback',
  })

  // STEP 7: SSR Rendering - Render server-side components
  tracker?.step('SSR_RENDER_START', 'Rendering server-side components')
  devLog('[InvitePage SSR] 🎨 SSR RENDERING: Starting server-side component rendering', {
    slug,
    hasConfig: !!initialConfig,
    hasTiles: !!(initialConfig?.tiles && initialConfig.tiles.length > 0),
  })

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
  
  tracker?.step('SSR_RENDER_COMPLETE', 'Server-side components rendered')
  devLog('[InvitePage SSR] ✅ SSR RENDERING: Server-side rendering complete', {
    slug,
    hasHeroSSR: !!heroSSR,
    hasEventDetailsSSR: !!eventDetailsSSR,
  })

    // STEP 8: Final Assembly - Prepare props for client component
    tracker?.step('FINAL_ASSEMBLY_START', 'Assembling final component props')
    devLog('[InvitePage SSR] 📦 FINAL ASSEMBLY: Preparing client component props', {
      slug,
      hasEvent: !!event,
      hasConfig: !!initialConfig,
    })

    // Extract allowed_sub_events from invite data
    const allowedSubEvents = inviteData?.allowed_sub_events || []
    
    tracker?.step('FINAL_ASSEMBLY_COMPLETE', 'Client component props ready')
    tracker?.step('RENDER_COMPLETE', 'Server-side render complete, returning JSX')
    
    // STEP 9: Final Render - Return JSX to Next.js
    devLog('[InvitePage SSR] 🎯 RENDERING: Returning JSX to Next.js', {
      slug,
      totalSteps: tracker ? tracker.getSummary().steps.length : 0,
    })
    
    if (tracker) {
      tracker.logSummary('PAGE RENDER')
      devLog('[InvitePage SSR] ====== PAGE RENDER COMPLETE ======', {
        slug,
        totalDuration: tracker.getSummary().totalDuration,
        timestamp: new Date().toISOString(),
      })
    } else {
      devLog('[InvitePage SSR] ====== PAGE RENDER COMPLETE ======', {
        slug,
        totalDuration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        note: 'Tracker not available',
      })
    }

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
    // STEP X: Unexpected Error - Catch any unexpected errors during SSR
    tracker?.step('UNEXPECTED_ERROR', 'Unexpected error caught')
    const elapsed = tracker ? tracker.getSummary().totalDuration : Date.now() - startTime
    
    console.error('[InvitePage SSR] 💥 UNEXPECTED ERROR: Exception during SSR', {
      slug,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
      elapsed,
      errorString: String(error),
      errorKeys: error ? Object.keys(error) : [],
    })
    
    if (tracker) {
      tracker.logSummary('PAGE RENDER (ERROR)')
    }
    
    // Try to parse error message if it's JSON
    let errorDetails: any = null
    try {
      if (error.message) {
        errorDetails = JSON.parse(error.message)
      }
    } catch (e) {
      errorDetails = {
        rawMessage: error.message,
        errorName: error.name,
        stack: error.stack,
      }
    }
    
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
}
