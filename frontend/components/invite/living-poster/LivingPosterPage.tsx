'use client'

import React, { useEffect } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { getTheme } from '@/lib/invite/themes'
import { ThemeProvider, useTheme } from './ThemeProvider'
import Hero from './Hero'
import Description from './Description'
import TilePreview from '@/components/invite/tiles/TilePreview'
import ScrollIndicator from '@/components/invite/ScrollIndicator'

interface LivingPosterPageProps {
  config: InviteConfig
  eventSlug: string
  eventDate?: string
  showBadge?: boolean
  hasRsvp?: boolean
  hasRegistry?: boolean
}

function LivingPosterContent({
  config,
  eventSlug,
  eventDate,
  showBadge = true,
  hasRsvp = false,
  hasRegistry = false,
}: LivingPosterPageProps) {
  const effectiveTheme = useTheme()

  // Set body background to match page background
  useEffect(() => {
    const bodyBackground = effectiveTheme.palette.bg
    document.body.style.backgroundColor = bodyBackground
    document.documentElement.style.backgroundColor = bodyBackground

    return () => {
      // Reset on unmount (optional, but clean)
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [effectiveTheme.palette.bg, config.customColors?.backgroundColor])

  // If tiles exist, render tile-based layout
  if (config.tiles && config.tiles.length > 0) {
    const sortedTiles = [...config.tiles]
      .filter(tile => tile.enabled)
      .sort((a, b) => a.order - b.order)

    return (
      <div className="min-h-screen w-full h-full" style={{ backgroundColor: effectiveTheme.palette.bg }}>
        {sortedTiles.map((tile) => {
          // Handle overlay case (title over image)
          if (tile.type === 'title' && tile.overlayTargetId) {
            const imageTile = config.tiles?.find(t => t.id === tile.overlayTargetId)
            if (imageTile && imageTile.type === 'image') {
              return (
                <div key={tile.id} className="relative w-full">
                  <TilePreview
                    tile={imageTile}
                    eventDate={eventDate}
                    eventSlug={eventSlug}
                    hasRsvp={hasRsvp}
                    hasRegistry={hasRegistry}
                    allTiles={config.tiles || []}
                  />
                  <TilePreview
                    tile={tile}
                    eventDate={eventDate}
                    eventSlug={eventSlug}
                    hasRsvp={hasRsvp}
                    hasRegistry={hasRegistry}
                    allTiles={config.tiles || []}
                  />
                </div>
              )
            }
          }

          // Skip image tile if it has a title overlay (already rendered above)
          if (tile.type === 'image' && config.tiles?.some(t => t.type === 'title' && t.overlayTargetId === tile.id)) {
            return null
          }

          return (
            <TilePreview
              key={tile.id}
              tile={tile}
              eventDate={eventDate}
              eventSlug={eventSlug}
              hasRsvp={hasRsvp}
              hasRegistry={hasRegistry}
              allTiles={config.tiles || []}
            />
          )
        })}
        <ScrollIndicator />
      </div>
    )
  }

  // Fallback to legacy hero/description layout
  return (
    <div className="min-h-screen h-full" style={{ backgroundColor: effectiveTheme.palette.bg, height: '100%' }}>
      <Hero
        config={config}
        theme={effectiveTheme}
        eventSlug={eventSlug}
        eventDate={eventDate}
        showBadge={showBadge}
      />
      {config.descriptionMarkdown && (
        <Description markdown={config.descriptionMarkdown} theme={effectiveTheme} />
      )}
      <ScrollIndicator />
    </div>
  )
}

export default function LivingPosterPage(props: LivingPosterPageProps) {
  const theme = getTheme(props.config.themeId)

  return (
    <ThemeProvider theme={theme} config={props.config}>
      <LivingPosterContent {...props} />
    </ThemeProvider>
  )
}

