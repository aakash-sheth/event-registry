/**
 * API functions for Invite Page
 */

import api from '@/lib/api'
import { InvitePage, InviteConfig } from './schema'
import type { InviteTemplate } from './templates'

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
  const response = await api.get(`/api/events/invite/${slug}/`)
  return response.data
}

export async function publishInvitePage(slug: string, isPublished: boolean): Promise<InvitePage> {
  const response = await api.post(`/api/events/invite/${slug}/publish/`, { is_published: isPublished })
  return response.data
}

/** API response shape for one invite design template */
export interface InviteDesignTemplateResponse {
  id: number
  name: string
  description?: string
  thumbnail: string
  preview_alt?: string
  config: InviteConfig
  visibility?: string
  status?: string
  created_by?: number
  created_by_name?: string | null
  updated_by?: number | null
  updated_by_name?: string | null
  created_at?: string
  updated_at?: string
}

/**
 * Fetch invite design templates from API (published + public for host library).
 * Returns empty array on failure so static templates can be used as fallback.
 */
export async function getInviteDesignTemplates(): Promise<InviteTemplate[]> {
  try {
    const response = await api.get<InviteDesignTemplateResponse[] | { results: InviteDesignTemplateResponse[] }>('/api/events/invite-templates/')
    const raw = response.data
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray((raw as any).results) ? (raw as any).results : [])
    return list.map((item: InviteDesignTemplateResponse) => ({
      id: String(item.id),
      name: item.name,
      description: item.description ?? undefined,
      thumbnail: item.thumbnail || '/invite-templates/minimal.svg',
      previewAlt: item.preview_alt ?? undefined,
      config: item.config,
      createdByName: item.created_by_name ?? undefined,
    }))
  } catch {
    return []
  }
}

/** Fetch all templates for Template Studio (staff); optional ?mine=1 for current user's only */
export async function getInviteDesignTemplatesForStudio(mine?: boolean): Promise<InviteDesignTemplateResponse[]> {
  const response = await api.get<InviteDesignTemplateResponse[] | { results: InviteDesignTemplateResponse[] }>('/api/events/invite-templates/', {
    params: mine ? { mine: '1' } : undefined,
  })
  if (Array.isArray(response.data)) return response.data
  const paginated = response.data as { results?: InviteDesignTemplateResponse[] }
  return Array.isArray(paginated?.results) ? paginated.results : []
}

/** Fetch one template by id (for Studio edit) */
export async function getInviteDesignTemplate(id: number): Promise<InviteDesignTemplateResponse> {
  const response = await api.get<InviteDesignTemplateResponse>(`/api/events/invite-templates/${id}/`)
  return response.data
}

/** Create template (staff only) */
export async function createInviteDesignTemplate(data: {
  name: string
  description?: string
  thumbnail?: string
  preview_alt?: string
  config: InviteConfig
  visibility?: string
  status?: string
}): Promise<InviteDesignTemplateResponse> {
  const response = await api.post<InviteDesignTemplateResponse>('/api/events/invite-templates/', data)
  return response.data
}

/** Update template (staff only) */
export async function updateInviteDesignTemplate(
  id: number,
  data: Partial<{
    name: string
    description: string
    thumbnail: string
    preview_alt: string
    config: InviteConfig
    visibility: string
    status: string
  }>
): Promise<InviteDesignTemplateResponse> {
  const response = await api.put<InviteDesignTemplateResponse>(`/api/events/invite-templates/${id}/`, data)
  return response.data
}

/** Delete template (staff only) */
export async function deleteInviteDesignTemplate(id: number): Promise<void> {
  await api.delete(`/api/events/invite-templates/${id}/`)
}

// ---------------------------------------------------------------------------
// Greeting Card Samples
// ---------------------------------------------------------------------------

export interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  width: number
  height?: number | null
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textAlign: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

export interface GreetingCardSample {
  id: number
  name: string
  description: string
  background_image_url: string
  text_overlays: TextOverlay[]
  tags: string[]
  sort_order: number
  is_active: boolean
  created_by?: number
  created_by_name?: string
  created_at?: string
  updated_at?: string
}

/** Fetch active greeting card samples (all authenticated users) */
export async function getGreetingCardSamples(): Promise<GreetingCardSample[]> {
  try {
    const response = await api.get<GreetingCardSample[] | { results: GreetingCardSample[] }>('/api/events/greeting-card-samples/')
    const raw = response.data
    return Array.isArray(raw) ? raw : ((raw as any).results ?? [])
  } catch {
    return []
  }
}

/** Fetch all greeting card samples for staff (includes inactive) */
export async function getGreetingCardSamplesForStudio(): Promise<GreetingCardSample[]> {
  const response = await api.get<GreetingCardSample[] | { results: GreetingCardSample[] }>('/api/events/greeting-card-samples/')
  const raw = response.data
  return Array.isArray(raw) ? raw : ((raw as any).results ?? [])
}

/** Fetch one greeting card sample by id */
export async function getGreetingCardSample(id: number): Promise<GreetingCardSample> {
  const response = await api.get<GreetingCardSample>(`/api/events/greeting-card-samples/${id}/`)
  return response.data
}

/** Create greeting card sample (staff only) */
export async function createGreetingCardSample(data: Partial<GreetingCardSample>): Promise<GreetingCardSample> {
  const response = await api.post<GreetingCardSample>('/api/events/greeting-card-samples/', data)
  return response.data
}

/** Update greeting card sample (staff only) */
export async function updateGreetingCardSample(id: number, data: Partial<GreetingCardSample>): Promise<GreetingCardSample> {
  const response = await api.put<GreetingCardSample>(`/api/events/greeting-card-samples/${id}/`, data)
  return response.data
}

/** Delete greeting card sample (staff only) */
export async function deleteGreetingCardSample(id: number): Promise<void> {
  await api.delete(`/api/events/greeting-card-samples/${id}/`)
}

/** Upload a background image for a greeting card sample (staff only) */
export async function uploadGreetingCardImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  const response = await api.post<{ url: string }>('/api/events/greeting-card-samples/upload-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (response.data.url) return response.data.url
  throw new Error('Upload failed')
}

