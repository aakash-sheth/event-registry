'use client'

import { useEffect } from 'react'

/**
 * Handles ChunkLoadError (stale deployment / CDN mismatch) by auto-reloading once.
 * Uses sessionStorage to prevent infinite reload loops if the deployment is truly broken.
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    // Clear the reload flag on successful hydration (page loaded fine)
    sessionStorage.removeItem('chunk-error-reloaded')

    const reload = () => {
      if (!sessionStorage.getItem('chunk-error-reloaded')) {
        sessionStorage.setItem('chunk-error-reloaded', '1')
        window.location.reload()
      }
    }

    const handleError = (event: ErrorEvent) => {
      if (event.error?.name === 'ChunkLoadError') {
        reload()
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'ChunkLoadError') {
        reload()
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
