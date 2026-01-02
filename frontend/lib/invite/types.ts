/**
 * TypeScript types for InvitePage state management
 * Fix 5: State machine types
 */

export enum InvitePageState {
  NOT_CREATED = 'not_created',
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export interface InvitePageWithState {
  id: number
  event: number
  event_slug: string
  slug: string
  background_url: string
  config: any
  is_published: boolean
  state: InvitePageState
  created_at: string
  updated_at: string
}

/**
 * Get InvitePage state from InvitePage object
 */
export function getInvitePageState(invitePage: { is_published: boolean } | null): InvitePageState {
  if (!invitePage) return InvitePageState.NOT_CREATED
  if (invitePage.is_published) return InvitePageState.PUBLISHED
  return InvitePageState.DRAFT
}

