import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

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

export default api

