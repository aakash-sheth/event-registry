/**
 * Invite page layout type (layouts are stored in DB and fetched via API).
 * applyLayout() clones config and assigns unique tile IDs when applying.
 */

import type { InviteConfig } from './schema'

export interface InvitePageLayout {
  id: string
  name: string
  description?: string
  thumbnail: string
  previewAlt?: string
  config: InviteConfig
  /** Creator attribution (from API layouts) */
  createdByName?: string
}
