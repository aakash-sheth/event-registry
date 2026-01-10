'use client'

import React from 'react'
import { Tile, TileType } from '@/lib/invite/schema'
import TitleTile from './TitleTile'
import ImageTile from './ImageTile'
import TimerTile from './TimerTile'
import EventDetailsTile from './EventDetailsTile'
import DescriptionTile from './DescriptionTile'
import FeatureButtonsTile from './FeatureButtonsTile'
import FooterTile from './FooterTile'
import EventCarouselTile from './EventCarouselTile'

export interface TilePreviewProps {
  tile: Tile
  eventDate?: string
  eventSlug?: string
  eventTitle?: string
  hasRsvp?: boolean
  hasRegistry?: boolean
  allTiles?: Tile[] // For overlay relationships
  allowedSubEvents?: any[] // Sub-events for event-carousel tile
}

export default function TilePreview({
  tile,
  eventDate,
  eventSlug,
  eventTitle,
  hasRsvp,
  hasRegistry,
  allTiles = [],
  allowedSubEvents = [],
}: TilePreviewProps) {
  if (!tile.enabled) return null

  const renderTile = () => {
    switch (tile.type) {
      case 'title':
        return (
          <TitleTile
            settings={tile.settings as any}
            preview
            overlayMode={tile.overlayTargetId !== undefined}
            overlayTargetTile={allTiles.find(t => t.id === tile.overlayTargetId)}
          />
        )
      case 'image':
        return (
          <ImageTile
            settings={tile.settings as any}
            preview
            hasTitleOverlay={allTiles.some(t => t.type === 'title' && t.overlayTargetId === tile.id)}
          />
        )
      case 'timer':
        // Get event date and time from event-details tile, fallback to eventDate prop
        const eventDetailsTile = allTiles.find(t => t.type === 'event-details' && t.enabled)
        const eventDetailsDate = eventDetailsTile && eventDetailsTile.type === 'event-details' 
          ? (eventDetailsTile.settings as import('@/lib/invite/schema').EventDetailsTileSettings).date
          : undefined
        const eventTime = eventDetailsTile && eventDetailsTile.type === 'event-details'
          ? (eventDetailsTile.settings as import('@/lib/invite/schema').EventDetailsTileSettings).time
          : undefined
        // Use date from event-details tile if available, otherwise use eventDate prop
        const timerDate = eventDetailsDate || eventDate
        return <TimerTile settings={tile.settings as any} preview eventDate={timerDate} eventTime={eventTime} eventSlug={eventSlug} eventTitle={eventTitle} />
      case 'event-details':
        return <EventDetailsTile settings={tile.settings as any} preview eventSlug={eventSlug} eventTitle={eventTitle} eventDate={eventDate} />
      case 'description':
        return <DescriptionTile settings={tile.settings as any} preview />
      case 'feature-buttons':
        return (
          <FeatureButtonsTile
            settings={tile.settings as any}
            preview
            hasRsvp={hasRsvp}
            hasRegistry={hasRegistry}
            eventSlug={eventSlug}
          />
        )
      case 'footer':
        return <FooterTile settings={tile.settings as any} preview />
      case 'event-carousel':
        // Don't render carousel if there are no sub-events to show
        if (!allowedSubEvents || allowedSubEvents.length === 0) {
          return null
        }
        return (
          <EventCarouselTile
            key={`event-carousel-${tile.id}`}
            settings={tile.settings as any}
            allowedSubEvents={allowedSubEvents}
            preview={true}
            eventSlug={eventSlug}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      {renderTile()}
    </div>
  )
}

