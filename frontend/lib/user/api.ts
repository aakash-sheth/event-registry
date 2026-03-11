/**
 * API functions for user settings (notification preferences, profile, etc.)
 */

import api from '@/lib/api'

export interface NotificationPreferences {
  rsvp_new: 'immediately' | 'daily_digest' | 'never'
  gift_received: 'immediately' | 'daily_digest' | 'never'
  marketing_emails: boolean
  updated_at: string
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await api.get('/api/notifications/preferences/')
  return response.data
}

export async function updateNotificationPreferences(
  data: Partial<Pick<NotificationPreferences, 'rsvp_new' | 'gift_received' | 'marketing_emails'>>
): Promise<NotificationPreferences> {
  const response = await api.put('/api/notifications/preferences/', data)
  return response.data
}
