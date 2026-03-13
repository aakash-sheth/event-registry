'use client'

import React, { useMemo } from 'react'
import { InviteConfig, Tile } from '@/lib/invite/schema'
import { getTheme } from '@/lib/invite/themes'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'

// Inviting sample copy for library previews so cards look like real invites, not placeholders
export const PREVIEW_SAMPLE = {
  title: "You're Invited",
  eventTitle: 'Sarah & James',
  date: '2025-06-14', // Saturday, June 14, 2025
  dateDisplay: 'Saturday, June 14 · 5:00 PM',
  location: 'The Garden Estate',
}

const CARD_SCALE = 0.28
const INVERSE_SCALE = 1 / CARD_SCALE

export interface TemplateCardPreviewProps {
  config: InviteConfig
  className?: string
}

/**
 * Injects sample event data (title, date, location) into a config's tiles so
 * previews look like real invites rather than blank placeholders.
 * Pure function — never mutates the original config.
 */
export function enrichConfigWithSampleData(config: InviteConfig): InviteConfig {
  if (!config.tiles?.length) return config
  const tiles = config.tiles.map((tile: Tile) => {
    if (tile.type === 'title') {
      const settings = { ...(tile.settings as Record<string, unknown>) }
      settings.text = tile.overlayTargetId ? PREVIEW_SAMPLE.eventTitle : PREVIEW_SAMPLE.title
      return { ...tile, settings }
    }
    if (tile.type === 'event-details') {
      const settings = { ...(tile.settings as Record<string, unknown>) }
      settings.date = PREVIEW_SAMPLE.date
      settings.location = PREVIEW_SAMPLE.location
      return { ...tile, settings }
    }
    return tile
  })
  return { ...config, tiles }
}

/**
 * Renders a live preview of an invite config inside a fixed aspect box (e.g. template library card).
 * Uses inviting sample copy so the library looks professional; same pipeline as the invite page.
 */
export default function TemplateCardPreview({ config, className = '' }: TemplateCardPreviewProps): React.ReactElement {
  const theme = getTheme(config?.themeId ?? 'classic-noir')
  const backgroundColor = config?.customColors?.backgroundColor ?? theme.palette.bg
  const previewConfig = useMemo(() => enrichConfigWithSampleData(config), [config])

  return (
    <div
      className={`w-full aspect-[9/16] overflow-hidden ${className}`}
      style={{ backgroundColor, background: backgroundColor }}
      aria-hidden
    >
      <div
        className="w-full h-full overflow-hidden"
        style={{
          transform: `scale(${CARD_SCALE})`,
          transformOrigin: 'top left',
          width: `${INVERSE_SCALE * 100}%`,
          minHeight: `${INVERSE_SCALE * 100}%`,
        }}
      >
        <LivingPosterPage
          config={previewConfig}
          eventSlug="preview"
          eventDate={PREVIEW_SAMPLE.dateDisplay}
          hasRsvp={true}
          hasRegistry={true}
          skipBackgroundColor={true}
          skipTextureOverlay={false}
          allowedSubEvents={[]}
        />
      </div>
    </div>
  )
}
