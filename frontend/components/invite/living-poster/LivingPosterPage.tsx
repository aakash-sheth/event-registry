'use client'

import React, { useEffect } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { ThemeProvider } from './ThemeProvider'
import Hero from './Hero'
import Description from './Description'
import TilePreview from '@/components/invite/tiles/TilePreview'
import ScrollIndicator from '@/components/invite/ScrollIndicator'
import TextureOverlay from './TextureOverlay'

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
  const backgroundColor = config.customColors?.backgroundColor || '#ffffff'

  // Set body background to match page background
  useEffect(() => {
    // Use setProperty with important flag to override CSS rules from globals.css
    document.body.style.setProperty('background-color', backgroundColor, 'important')
    document.documentElement.style.setProperty('background-color', backgroundColor, 'important')
    // Also set background (not just background-color) to override CSS background property
    document.body.style.setProperty('background', backgroundColor, 'important')
    document.documentElement.style.setProperty('background', backgroundColor, 'important')

    return () => {
      // Reset on unmount (optional, but clean)
      document.body.style.removeProperty('background-color')
      document.body.style.removeProperty('background')
      document.documentElement.style.removeProperty('background-color')
      document.documentElement.style.removeProperty('background')
    }
  }, [backgroundColor])

  // If tiles exist, render tile-based layout
  if (config.tiles && config.tiles.length > 0) {
    const sortedTiles = [...config.tiles]
      .filter(tile => tile.enabled)
      .sort((a, b) => a.order - b.order)

    return (
      <div className="min-h-screen w-full h-full relative" style={{ backgroundColor, background: backgroundColor } as React.CSSProperties}>
        <TextureOverlay 
          type={config.texture?.type || 'none'} 
          intensity={config.texture?.intensity || 40} 
        />
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
    <div className="min-h-screen h-full relative" style={{ backgroundColor, background: backgroundColor, height: '100%' } as React.CSSProperties}>
      <TextureOverlay 
        type={config.texture?.type || 'none'} 
        intensity={config.texture?.intensity || 40} 
      />
      <Hero
        config={config}
        eventSlug={eventSlug}
        eventDate={eventDate}
        showBadge={showBadge}
      />
      {config.descriptionMarkdown && (
        <Description markdown={config.descriptionMarkdown} config={config} />
      )}
      <ScrollIndicator />
    </div>
  )
}

export default function LivingPosterPage(props: LivingPosterPageProps) {
  return (
    <ThemeProvider config={props.config}>
      <LivingPosterContent {...props} />
    </ThemeProvider>
  )
}

