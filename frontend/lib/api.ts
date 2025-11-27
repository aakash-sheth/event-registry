import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Get API base URL - use build-time env var or runtime detection
// In production/staging, if we're on the staging domain, use the ALB URL
let API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

// Runtime override: If we're running in production and API_BASE is still localhost,
// try to detect the correct URL from the current origin
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  const currentOrigin = window.location.origin
  // If we're on staging ALB and API_BASE is localhost, use the ALB URL
  if (API_BASE.includes('localhost') && currentOrigin.includes('staging-alb')) {
    API_BASE = currentOrigin.replace(/^https?:\/\//, 'http://')
    console.warn('[API] Overriding localhost API_BASE with:', API_BASE)
  }
}

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
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  
  const response = await api.post('/api/events/upload-image/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  if (response.data.url) {
    return response.data.url
  }
  
  throw new Error(response.data.error || 'Failed to upload image')
}

