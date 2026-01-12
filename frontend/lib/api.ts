import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

/**
 * Get API base URL with automatic mixed content fix
 * - Uses NEXT_PUBLIC_API_BASE from build-time env
 * - In production, if page is HTTPS but API_BASE is HTTP, uses current origin
 * - This fixes mixed content issues when using CloudFront or HTTPS-enabled distributions
 */
function getApiBase(): string {
  let apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
  
  // Fix for Docker: host.docker.internal only works inside containers, not in browser
  // Replace with localhost for client-side calls
  if (typeof window !== 'undefined' && apiBase.includes('host.docker.internal')) {
    apiBase = apiBase.replace('host.docker.internal', 'localhost')
  }
  
  // Log API base for debugging (development only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[API] API Base URL:', {
      fromEnv: process.env.NEXT_PUBLIC_API_BASE,
      resolved: apiBase,
      currentOrigin: window.location.origin,
      nodeEnv: process.env.NODE_ENV,
    })
  }
  
  // Runtime override: Fix mixed content issues
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    const currentOrigin = window.location.origin
    const isPageHTTPS = currentOrigin.startsWith('https://')
    const isApiHTTP = apiBase.startsWith('http://')
    
    // If page is HTTPS but API is HTTP, use current origin (HTTPS)
    // This handles CloudFront -> ALB and other HTTPS distribution scenarios
    if (isPageHTTPS && isApiHTTP) {
      apiBase = currentOrigin
      if (process.env.NODE_ENV === 'development' as string) {
        console.warn('[API] Auto-fixing mixed content: Using HTTPS origin:', apiBase)
      }
    }
  }
  
  // Validate API base URL
  if (!apiBase || (!apiBase.startsWith('http://') && !apiBase.startsWith('https://'))) {
    console.error('[API] Invalid API base URL:', apiBase)
    // Fallback to localhost in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      apiBase = 'http://localhost:8000'
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] Using fallback API base:', apiBase)
      }
    } else {
      // In production, use current origin
      apiBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] Using current origin as API base:', apiBase)
      }
    }
  }
  
  return apiBase
}

// Get API base URL dynamically (not at module load time)
// This ensures window is available for client-side calls
function getApiBaseUrl(): string {
  // If we're in the browser, compute it dynamically
  if (typeof window !== 'undefined') {
    return getApiBase()
  }
  // For server-side, use environment variable or default
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
  // Replace host.docker.internal with localhost for server-side too
  return apiBase.replace('host.docker.internal', 'localhost')
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: any) => void
  reject: (error?: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Add auth token to requests and fix baseURL for client-side
api.interceptors.request.use((config) => {
  // Fix baseURL for client-side requests
  // This ensures host.docker.internal is always replaced with localhost in the browser
  if (typeof window !== 'undefined' && config.baseURL) {
    let baseURL = config.baseURL
    // Replace host.docker.internal with localhost for browser requests
    if (baseURL.includes('host.docker.internal')) {
      baseURL = baseURL.replace('host.docker.internal', 'localhost')
      config.baseURL = baseURL
    }
    // Validate the URL is still valid
    if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] Invalid baseURL after replacement:', baseURL)
      }
      config.baseURL = 'http://localhost:8000'
    }
  }
  
  // Add auth token with retry logic for new devices (handles slow localStorage)
  if (typeof window !== 'undefined') {
    let token = localStorage.getItem('access_token')
    
    // If token is null, wait a bit and retry (handles slow localStorage writes on new devices)
    if (!token) {
      // Small delay to allow localStorage write to complete
      // This is a synchronous operation, but browser I/O can be slow on new devices
      const retryToken = () => {
        for (let i = 0; i < 3; i++) {
          token = localStorage.getItem('access_token')
          if (token) break
          // Synchronous wait (blocking, but very short - max 30ms total)
          const start = Date.now()
          while (Date.now() - start < 10) {} // 10ms max wait per attempt
        }
        return token
      }
      token = retryToken()
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      // Token still not available - this might be a public request
      // Don't fail, let the backend handle it
      // Log warning for debugging but don't block the request
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] No access token available for request:', config.url)
      }
    }
  }
  
  // CRITICAL: Detect and warn about incorrect invite endpoint usage
  // Public invite pages should use /api/events/invite/{slug}/, NOT /api/events/{id}/invite/
  // BUT: ID-based endpoints are OK for authenticated hosts (internal use)
  if (config.url && config.url.includes('/invite/')) {
    const isWrongPattern = /\/api\/events\/\d+\/invite\//.test(config.url)
    const isCorrectPattern = /\/api\/events\/invite\/[^/]+\//.test(config.url)
    
    // Check if request is authenticated (has auth token)
    // Check both the config headers (set above) and localStorage directly
    const tokenInHeaders = config.headers && (
      config.headers['Authorization'] || 
      config.headers['authorization'] ||
      config.headers.Authorization
    )
    const tokenInLocalStorage = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    const isAuthenticated = !!(tokenInHeaders || tokenInLocalStorage)
    
    // Only warn if:
    // 1. Using wrong pattern (ID-based)
    // 2. NOT using correct pattern (slug-based)
    // 3. Request is NOT authenticated (no auth token means it's a public request)
    if (isWrongPattern && !isCorrectPattern && !isAuthenticated) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] ⚠️ WRONG INVITE ENDPOINT DETECTED (public requests should use slug):', {
          url: config.url,
          method: config.method,
          correctPattern: '/api/events/invite/{slug}/',
          wrongPattern: '/api/events/{id}/invite/',
          note: 'ID-based endpoints are OK for authenticated hosts, but public requests must use slug',
          stackTrace: new Error().stack,
        })
      }
      // Don't block the request, but log it for debugging
    }
  }
  
  // Ensure trailing slash for POST/PUT/PATCH requests to Django
  if (config.url && ['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
    if (!config.url.endsWith('/') && !config.url.includes('?')) {
      config.url += '/'
    }
  }
  
  return config
})

// Handle 401 errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Silently handle 404 for system-default-template endpoint (expected when template doesn't exist)
    if (error.response?.status === 404 && originalRequest?.url?.includes('/system-default-template/')) {
      // Return a response object that mimics a 404 but won't throw
      return Promise.resolve({
        status: 404,
        statusText: 'Not Found',
        data: null,
        headers: {},
        config: originalRequest,
      } as any)
    }

    // If error is 401 and we haven't already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return api(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null

      if (!refreshToken) {
        // No refresh token, redirect to login
        processQueue(error, null)
        isRefreshing = false
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/host/login'
        }
        return Promise.reject(error)
      }

      try {
        // Try to refresh the token
        // Use getApiBaseUrl() to ensure correct base URL resolution
        const refreshUrl = `${getApiBaseUrl()}/api/auth/token/refresh/`
        const response = await axios.post(
          refreshUrl,
          { refresh: refreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        const { access } = response.data

        // Update tokens
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access)
          // If backend returns new refresh token, update it
          if (response.data.refresh) {
            localStorage.setItem('refresh_token', response.data.refresh)
          }
        }

        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`
        }

        // Process queued requests
        processQueue(null, access)
        isRefreshing = false

        // Retry the original request
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        processQueue(refreshError, null)
        isRefreshing = false
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/host/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api

/**
 * Upload an image file to S3 via backend
 * @param file - Image file to upload
 * @returns Promise resolving to S3 URL string
 */
export async function uploadImage(file: File, eventId: number): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  
  const response = await api.post(`/api/events/${eventId}/upload-image/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  if (response.data.url) {
    return response.data.url
  }
  
  throw new Error(response.data.error || 'Failed to upload image')
}

// Sub-events API functions
export async function getSubEvents(eventId: number) {
  const response = await api.get(`/api/events/envelopes/${eventId}/sub-events/`)
  return response.data.results || response.data || []
}

export async function createSubEvent(eventId: number, data: any) {
  const response = await api.post(`/api/events/envelopes/${eventId}/sub-events/`, data)
  return response.data
}

export async function updateSubEvent(subEventId: number, data: any) {
  const response = await api.put(`/api/events/sub-events/${subEventId}/`, data)
  return response.data
}

export async function deleteSubEvent(subEventId: number) {
  const response = await api.delete(`/api/events/sub-events/${subEventId}/`)
  return response.data
}

// Guest invite management
export async function getGuestInvites(eventId: number) {
  const response = await api.get(`/api/events/envelopes/${eventId}/guests/invites/`)
  return response.data
}

export async function updateGuestInvites(eventId: number, guestId: number, subEventIds: number[]) {
  const response = await api.put(`/api/events/guests/${guestId}/invites/`, {
    sub_event_ids: subEventIds
  })
  return response.data
}

// WhatsApp Template API functions
export interface WhatsAppTemplate {
  id: number
  event: number
  name: string
  message_type: 'invitation' | 'reminder' | 'update' | 'venue_change' | 'time_change' | 'thank_you' | 'custom'
  template_text: string
  description?: string
  usage_count: number
  is_active: boolean
  last_used_at?: string | null
  is_default?: boolean
  is_system_default?: boolean
  created_by?: number
  created_at: string
  updated_at: string
  preview?: string
  available_variables?: Array<{
    key: string
    label: string
    description: string
    example: string
    is_custom?: boolean
  }>
}

export interface CreateWhatsAppTemplateData {
  name: string
  message_type: string
  template_text: string
  description?: string
  is_default?: boolean
}

export async function getWhatsAppTemplates(eventId: number): Promise<WhatsAppTemplate[]> {
  const response = await api.get(`/api/events/${eventId}/whatsapp-templates/`)
  return response.data.results || response.data || []
}

export async function getWhatsAppTemplate(templateId: number): Promise<WhatsAppTemplate> {
  const response = await api.get(`/api/events/whatsapp-templates/${templateId}/`)
  return response.data
}

export async function createWhatsAppTemplate(eventId: number, data: CreateWhatsAppTemplateData): Promise<WhatsAppTemplate> {
  const response = await api.post(`/api/events/${eventId}/whatsapp-templates/`, {
    ...data,
    event: eventId
  })
  return response.data
}

export async function updateWhatsAppTemplate(templateId: number, data: Partial<CreateWhatsAppTemplateData>): Promise<WhatsAppTemplate> {
  const response = await api.patch(`/api/events/whatsapp-templates/${templateId}/`, data)
  return response.data
}

export async function deleteWhatsAppTemplate(templateId: number): Promise<void> {
  await api.delete(`/api/events/whatsapp-templates/${templateId}/`)
}

export async function previewWhatsAppTemplate(templateId: number, sampleData?: Record<string, any>): Promise<{ preview: string; template: WhatsAppTemplate }> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/preview/`, {
    sample_data: sampleData || {}
  })
  return response.data
}

export async function duplicateWhatsAppTemplate(templateId: number, newName?: string): Promise<WhatsAppTemplate> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/duplicate/`, {
    name: newName
  })
  return response.data
}

export async function archiveWhatsAppTemplate(templateId: number): Promise<WhatsAppTemplate> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/archive/`)
  return response.data
}

export async function activateWhatsAppTemplate(templateId: number): Promise<WhatsAppTemplate> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/activate/`)
  return response.data
}

export async function incrementWhatsAppTemplateUsage(templateId: number): Promise<WhatsAppTemplate> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/increment-usage/`)
  return response.data
}

export async function setDefaultTemplate(templateId: number): Promise<WhatsAppTemplate> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/set-default/`)
  return response.data
}

export async function getAvailableVariables(eventId: number): Promise<Array<{
  key: string
  label: string
  description: string
  example: string
  is_custom?: boolean
}>> {
  const response = await api.get(`/api/events/${eventId}/whatsapp-templates/available-variables/`)
  return response.data.variables || []
}

export async function getDescriptionVariables(eventId: number): Promise<Array<{
  key: string
  label: string
  description: string
  example: string
  is_custom?: boolean
}>> {
  const response = await api.get(`/api/events/${eventId}/description-variables/`)
  return response.data.variables || []
}

export async function previewWhatsAppMessage(eventId: number, data: {
  template_id?: number
  guest_id?: number
  raw_body?: string
}): Promise<{
  preview: string
  warnings: {
    unresolved_variables: string[]
    missing_custom_fields: string[]
  }
}> {
  const response = await api.post(`/api/events/${eventId}/whatsapp-preview/`, data)
  return response.data
}

export async function getSystemDefaultTemplate(eventId: number): Promise<WhatsAppTemplate | null> {
  try {
    // The response interceptor will handle 404s silently for this endpoint
    const response = await api.get(`/api/events/${eventId}/system-default-template/`, {
      validateStatus: (status) => status === 200 || status === 404
    })
    if (response.status === 404) {
      return null
    }
    return response.data
  } catch (error: any) {
    // Fallback error handling (shouldn't reach here with interceptor + validateStatus)
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export async function previewTemplateWithGuest(templateId: number, guestId: number): Promise<{
  preview: string
  warnings: {
    unresolved_variables: string[]
    missing_custom_fields: string[]
  }
  template: WhatsAppTemplate
  guest: any
}> {
  const response = await api.post(`/api/events/whatsapp-templates/${templateId}/preview-with-guest/`, {
    guest_id: guestId
  })
  return response.data
}

