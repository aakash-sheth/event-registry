/**
 * API functions for Invite Page
 */

import api from '@/lib/api'
import { InvitePage, InviteConfig } from './schema'

export async function getInvitePage(eventId: number): Promise<InvitePage | null> {
  try {
    const response = await api.get(`/api/events/${eventId}/invite/`)
    return response.data
  } catch (error: any) {
    // 404 means invite page doesn't exist yet - that's okay, return null
    // This is expected behavior for new events, so we handle it silently
    if (error.response?.status === 404) {
      return null
    }
    // Re-throw other errors (401, 500, etc.) so they can be handled by the caller
    throw error
  }
}

export async function createInvitePage(
  eventId: number,
  data: { slug?: string; background_url?: string; config: InviteConfig }
): Promise<InvitePage> {
  const response = await api.post(`/api/events/${eventId}/invite/`, data)
  return response.data
}

export async function updateInvitePage(
  eventId: number,
  data: { background_url?: string; config?: InviteConfig; is_published?: boolean }
): Promise<InvitePage> {
  const response = await api.put(`/api/events/${eventId}/invite/`, data)
  return response.data
}

export async function getPublicInvite(slug: string): Promise<InvitePage> {
  const response = await api.get(`/api/invite/${slug}/`)
  return response.data
}

export async function publishInvitePage(slug: string, isPublished: boolean): Promise<InvitePage> {
  const response = await api.post(`/api/invite/${slug}/publish/`, { is_published: isPublished })
  return response.data
}

