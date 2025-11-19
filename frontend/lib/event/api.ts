/**
 * API functions for Event page_config
 */

import api from '@/lib/api'
import { InviteConfig } from '@/lib/invite/schema'

export interface EventPageConfig {
  page_config?: InviteConfig & { background_url?: string }
}

export async function getEventPageConfig(eventId: number): Promise<EventPageConfig | null> {
  try {
    const response = await api.get(`/api/events/${eventId}/`)
    return { page_config: response.data.page_config || null }
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 401) {
      return null
    }
    throw error
  }
}

export async function updateEventPageConfig(
  eventId: number,
  pageConfig: InviteConfig & { background_url?: string }
): Promise<void> {
  await api.put(`/api/events/${eventId}/design/`, {
    page_config: pageConfig,
  })
}

