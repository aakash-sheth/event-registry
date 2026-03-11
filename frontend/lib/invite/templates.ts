/**
 * Invite template type (templates are stored in DB and fetched via API).
 * applyTemplate() clones config and assigns unique tile IDs when applying.
 */

import type { InviteConfig } from './schema'

export interface InviteTemplate {
  id: string
  name: string
  description?: string
  thumbnail: string
  previewAlt?: string
  config: InviteConfig
  /** Creator attribution (from API templates) */
  createdByName?: string
}
