import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

/**
 * Get API base URL with automatic mixed content fix
 * - Uses NEXT_PUBLIC_API_BASE from build-time env
 * - In production, if page is HTTPS but API_BASE is HTTP, uses current origin
 * - This fixes mixed content issues when using CloudFront or HTTPS-enabled distributions
 */
function getApiBase(): string {
  let apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
  
  // Runtime override: Fix mixed content issues
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    const currentOrigin = window.location.origin
    const isPageHTTPS = currentOrigin.startsWith('https://')
    const isApiHTTP = apiBase.startsWith('http://')
    
    // If page is HTTPS but API is HTTP, use current origin (HTTPS)
    // This handles CloudFront -> ALB and other HTTPS distribution scenarios
    if (isPageHTTPS && isApiHTTP) {
      apiBase = currentOrigin
      console.warn('[API] Auto-fixing mixed content: Using HTTPS origin:', apiBase)
    }
  }
  
  return apiBase
}

const API_BASE = getApiBase()

const api = axios.create({
  baseURL: API_BASE,
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

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
        const response = await axios.post(
          `${API_BASE}/api/auth/token/refresh/`,
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
  const response = await api.put(`/api/events/envelopes/${eventId}/guests/${guestId}/invites/`, {
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
    const response = await api.get(`/api/events/${eventId}/system-default-template/`)
    return response.data
  } catch (error: any) {
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

