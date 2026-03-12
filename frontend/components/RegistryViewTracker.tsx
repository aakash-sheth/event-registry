'use client'

import { useEffect } from 'react'
import api from '@/lib/api'

interface RegistryViewTrackerProps {
  slug: string
  gt: string
}

/**
 * Fire-and-forget component that records a RegistryPageView when a guest
 * opens the registry page. Renders nothing; any error is silently swallowed
 * so it never breaks the page for the guest.
 */
export function RegistryViewTracker({ slug, gt }: RegistryViewTrackerProps) {
  useEffect(() => {
    if (!slug || !gt) return
    api
      .post(`/api/events/registry/${slug}/view/`, null, { params: { gt } })
      .catch(() => {
        // Fire-and-forget — tracking failure must never degrade the guest experience
      })
  }, [slug, gt])

  return null
}
