/**
 * API functions for Invite Page
 */

import api from '@/lib/api'
import { InvitePage, InviteConfig } from './schema'
import type { InvitePageLayout } from './pageLayouts'

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

/** API response shape for one invite page layout */
export interface InvitePageLayoutResponse {
  id: number
  name: string
  description?: string
  thumbnail: string
  card_sample?: number | null
  card_code?: string | null
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
 * Fetch invite page layouts from API (published + public for host library).
 * Returns empty array on failure so static layouts can be used as fallback.
 */
export async function getInvitePageLayouts(options?: { designCode?: string }): Promise<InvitePageLayout[]> {
  try {
    const params: Record<string, string> = {}
    const designCode = options?.designCode?.trim()
    if (designCode) params.design_code = designCode
    const response = await api.get<InvitePageLayoutResponse[] | { results: InvitePageLayoutResponse[] }>(
      '/api/events/invite-page-layouts/',
      Object.keys(params).length ? { params } : undefined,
    )
    const raw = response.data
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray((raw as any).results) ? (raw as any).results : [])
    return list.map((item: InvitePageLayoutResponse) => ({
      id: String(item.id),
      name: item.name,
      description: item.description ?? undefined,
      thumbnail: item.thumbnail || '/invite-templates/minimal.svg',
      previewAlt: item.preview_alt ?? undefined,
      config: item.config,
      cardCode: item.card_code ?? undefined,
      createdByName: item.created_by_name ?? undefined,
    }))
  } catch {
    return []
  }
}

/** Fetch all page layouts for Page Layout Studio (staff). */
export async function getInvitePageLayoutsForStudio(options?: {
  mine?: boolean
  /** Filter to layouts linked to this design (GreetingCardSample.code). */
  designCode?: string
}): Promise<InvitePageLayoutResponse[]> {
  const params: Record<string, string> = {}
  if (options?.mine) params.mine = '1'
  const c = options?.designCode?.trim()
  if (c) params.design_code = c
  const response = await api.get<InvitePageLayoutResponse[] | { results: InvitePageLayoutResponse[] }>(
    '/api/events/invite-page-layouts/',
    Object.keys(params).length ? { params } : undefined,
  )
  if (Array.isArray(response.data)) return response.data
  const paginated = response.data as { results?: InvitePageLayoutResponse[] }
  return Array.isArray(paginated?.results) ? paginated.results : []
}

/** Fetch one page layout by id (for Studio edit) */
export async function getInvitePageLayout(id: number): Promise<InvitePageLayoutResponse> {
  const response = await api.get<InvitePageLayoutResponse>(`/api/events/invite-page-layouts/${id}/`)
  return response.data
}

/** Create page layout (staff only) */
export async function createInvitePageLayout(data: {
  name: string
  description?: string
  thumbnail?: string
  preview_alt?: string
  config: InviteConfig
  visibility?: string
  status?: string
}): Promise<InvitePageLayoutResponse> {
  const response = await api.post<InvitePageLayoutResponse>('/api/events/invite-page-layouts/', data)
  return response.data
}

/** Update page layout (staff only) */
export async function updateInvitePageLayout(
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
): Promise<InvitePageLayoutResponse> {
  const response = await api.put<InvitePageLayoutResponse>(`/api/events/invite-page-layouts/${id}/`, data)
  return response.data
}

/** Delete page layout (staff only) */
export async function deleteInvitePageLayout(id: number): Promise<void> {
  await api.delete(`/api/events/invite-page-layouts/${id}/`)
}

// ---------------------------------------------------------------------------
// Design Samples
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

export type AspectRatio = '9:16' | '1:1' | '4:5' | '3:4' | '16:9'

export interface DesignSample {
  id: number
  /** Stable design code (e.g. DSGN-0042) used to link layouts. */
  code?: string
  name: string
  description: string
  background_image_url: string
  /** Small derivative for catalog grids; falls back to background_image_url when empty. */
  thumbnail_url?: string
  text_overlays: TextOverlay[]
  /** Canvas aspect ratio — e.g. '9:16', '1:1'. Defaults to '9:16'. */
  aspect_ratio?: AspectRatio
  tags: string[]
  sort_order: number
  is_active: boolean
  created_by?: number
  created_by_name?: string
  created_at?: string
  updated_at?: string
}

export interface DesignSamplesPage {
  results: DesignSample[]
  count: number
  hasNext: boolean
}

interface PaginatedDesignSampleResponse {
  count: number
  next: string | null
  previous: string | null
  results: DesignSample[]
}

/**
 * Fetch a single page of design samples with optional server-side search.
 * The catalog API is paginated (`{count,next,previous,results}`); this is the
 * preferred fetch for catalog grids that lazy-load.
 */
export async function getDesignSamplesPage(options?: {
  page?: number
  pageSize?: number
  q?: string
  tags?: string
}): Promise<DesignSamplesPage> {
  const params: Record<string, string | number> = {}
  if (options?.page) params.page = options.page
  if (options?.pageSize) params.page_size = options.pageSize
  const q = options?.q?.trim()
  if (q) params.q = q
  const tags = options?.tags?.trim()
  if (tags) params.tags = tags
  try {
    const response = await api.get<PaginatedDesignSampleResponse | DesignSample[]>(
      '/api/events/greeting-card-samples/',
      Object.keys(params).length ? { params } : undefined,
    )
    const raw = response.data
    if (Array.isArray(raw)) {
      return { results: raw, count: raw.length, hasNext: false }
    }
    return {
      results: raw.results ?? [],
      count: raw.count ?? (raw.results ?? []).length,
      hasNext: Boolean(raw.next),
    }
  } catch {
    return { results: [], count: 0, hasNext: false }
  }
}

/** Follow pagination to load every page (used where the full list is required). */
async function getAllDesignSamples(): Promise<DesignSample[]> {
  const all: DesignSample[] = []
  let page = 1
  // Cap iterations defensively so a misbehaving API can't loop forever.
  for (let i = 0; i < 200; i++) {
    const { results, hasNext } = await getDesignSamplesPage({ page, pageSize: 60 })
    all.push(...results)
    if (!hasNext || results.length === 0) break
    page += 1
  }
  return all
}

/** Fetch active design samples (all authenticated users). Loads the full list. */
export async function getDesignSamples(): Promise<DesignSample[]> {
  try {
    return await getAllDesignSamples()
  } catch {
    return []
  }
}

/** Fetch all design samples for staff (includes inactive). Loads the full list. */
export async function getDesignSamplesForStudio(): Promise<DesignSample[]> {
  return getAllDesignSamples()
}

/** Fetch one design sample by id */
export async function getDesignSample(id: number): Promise<DesignSample> {
  const response = await api.get<DesignSample>(`/api/events/greeting-card-samples/${id}/`)
  return response.data
}

/**
 * Resolve a design sample by its exact background image URL. Used only to
 * hydrate the stable design code for selections saved before codes existed
 * (back-compat); returns null when no catalog design matches the URL.
 */
export async function getDesignSampleByBackgroundUrl(bgUrl: string): Promise<DesignSample | null> {
  const url = bgUrl?.trim()
  if (!url) return null
  try {
    const response = await api.get<PaginatedDesignSampleResponse | DesignSample[]>(
      '/api/events/greeting-card-samples/',
      { params: { background_url: url, page_size: 1 } },
    )
    const raw = response.data
    const results = Array.isArray(raw) ? raw : (raw.results ?? [])
    return results[0] ?? null
  } catch {
    return null
  }
}

/** Create design sample (staff only) */
export async function createDesignSample(data: Partial<DesignSample>): Promise<DesignSample> {
  const response = await api.post<DesignSample>('/api/events/greeting-card-samples/', data)
  return response.data
}

/** Update design sample (staff only) */
export async function updateDesignSample(id: number, data: Partial<DesignSample>): Promise<DesignSample> {
  const response = await api.put<DesignSample>(`/api/events/greeting-card-samples/${id}/`, data)
  return response.data
}

/** Delete design sample (staff only) */
export async function deleteDesignSample(id: number): Promise<void> {
  await api.delete(`/api/events/greeting-card-samples/${id}/`)
}

export interface DesignImageUploadResult {
  url: string
  thumbnail_url: string
}

/**
 * Upload a background image for a design sample (staff only).
 * Returns both the full image URL and the generated thumbnail URL
 * (`thumbnail_url` may be empty when a thumbnail couldn't be generated).
 */
export async function uploadDesignImage(file: File): Promise<DesignImageUploadResult> {
  const formData = new FormData()
  formData.append('image', file)
  const response = await api.post<{ url: string; thumbnail_url?: string }>(
    '/api/events/greeting-card-samples/upload-image/',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  if (response.data.url) {
    return { url: response.data.url, thumbnail_url: response.data.thumbnail_url ?? '' }
  }
  throw new Error('Upload failed')
}

