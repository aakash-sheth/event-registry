/**
 * Error handler utility for user-friendly error messages
 * Returns user-friendly messages in production, more detailed in development
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

/**
 * Get user-friendly error message from error object
 * @param error - Error object from API call or exception
 * @returns User-friendly error message
 */
export function getErrorMessage(error: any): string {
  // Handle network/connection errors
  // Check error code first (Axios uses error.code)
  const errorCode = error.code || ''
  const errorMessage = error.message || ''
  const isConnectionError = 
    errorCode === 'ERR_NETWORK' ||
    errorCode === 'ERR_CONNECTION_REFUSED' ||
    errorCode === 'ERR_CONNECTION_RESET' ||
    errorCode === 'ECONNREFUSED' ||
    errorMessage === 'Network Error' ||
    errorMessage.includes('ERR_CONNECTION') ||
    errorMessage.includes('ERR_NETWORK') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('Connection refused')
  
  if (isConnectionError) {
    // In development, provide more helpful message if backend might not be running
    if (isDevelopment && (API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1'))) {
      return 'Unable to connect to the backend server. Please make sure the backend is running on port 8000.'
    }
    return 'Unable to connect. Please check your internet connection and try again.'
  }

  // Handle timeout errors
  if (errorCode === 'ECONNABORTED' || errorMessage.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }

  // Handle API response errors
  const status = error.response?.status
  const errorData = error.response?.data

  if (status === 400) {
    // Bad request - validation errors
    if (errorData?.error) {
      return errorData.error
    }
    if (errorData?.detail) {
      return errorData.detail
    }
    if (typeof errorData === 'object' && Object.keys(errorData).length > 0) {
      // Return first validation error message
      const firstError = Object.values(errorData)[0]
      if (Array.isArray(firstError)) {
        return firstError[0] as string
      }
      return String(firstError)
    }
    return 'Please check your input and try again.'
  }

  if (status === 401) {
    return 'Please log in to continue.'
  }

  if (status === 403) {
    return 'You don\'t have permission to perform this action.'
  }

  if (status === 404) {
    return 'The requested item was not found.'
  }

  if (status === 409) {
    return errorData?.error || errorData?.detail || 'This item already exists.'
  }

  if (status === 422) {
    return errorData?.error || errorData?.detail || 'Invalid data provided.'
  }

  if (status === 500 || status === 503) {
    return 'Something went wrong on our end. Please try again in a moment.'
  }

  // In development, show more details
  if (isDevelopment && errorData?.error) {
    return errorData.error
  }

  if (isDevelopment && errorData?.detail) {
    return errorData.detail
  }

  if (isDevelopment && error.message) {
    return error.message
  }

  // Fallback - never show technical details in production
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Log error to console (only in development)
 * @param message - Log message
 * @param error - Error object (optional)
 */
export function logError(message: string, error?: any): void {
  if (isDevelopment) {
    if (error) {
      console.error(message, error)
    } else {
      console.error(message)
    }
  }
}

/**
 * Log debug information (only in development)
 * @param message - Log message
 * @param data - Additional data to log (optional)
 */
export function logDebug(message: string, data?: any): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}

