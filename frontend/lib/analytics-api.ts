'use client'

import api from '@/lib/api'

// Analytics API interfaces
export interface GuestAnalytics {
  id: number
  name: string
  phone: string
  email: string
  invite_views_count: number
  rsvp_views_count: number
  last_invite_view: string | null
  last_rsvp_view: string | null
  has_viewed_invite: boolean
  has_viewed_rsvp: boolean
}

export interface EventAnalyticsSummary {
  total_guests: number
  guests_with_invite_views: number
  guests_with_rsvp_views: number
  total_invite_views: number
  total_rsvp_views: number
  invite_view_rate: number
  rsvp_view_rate: number
  engagement_rate: number
  attribution_clicks_total?: number
  target_type_clicks?: Record<string, number>
  source_channel_breakdown?: Record<string, number>
  funnel?: {
    invite?: { clicks: number; views: number; rsvp_submissions: number }
    rsvp?: { clicks: number; views: number; rsvp_submissions: number }
    registry?: { clicks: number; paid_orders: number }
  }
  insights_locked?: boolean
  insights_cta_label?: string
  metric_definitions?: Record<string, string>
}

export interface GuestsAnalyticsResponse {
  event_id: number
  event_title: string
  total_guests: number
  guests: GuestAnalytics[]
}

// Analytics API functions
export async function getGuestsAnalytics(eventId: number): Promise<GuestsAnalyticsResponse> {
  const response = await api.get(`/api/events/${eventId}/guests/analytics/`)
  return response.data
}

export async function getEventAnalyticsSummary(eventId: number): Promise<EventAnalyticsSummary> {
  const response = await api.get(`/api/events/${eventId}/analytics/summary/`)
  return response.data
}
