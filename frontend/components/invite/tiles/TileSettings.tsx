'use client'

import React, { useState, useEffect } from 'react'
import { Tile, TileType } from '@/lib/invite/schema'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import TitleTileSettings from './TitleTileSettings'
import ImageTileSettings from './ImageTileSettings'
import TimerTileSettings from './TimerTileSettings'
import EventDetailsTileSettings from './EventDetailsTileSettings'
import DescriptionTileSettings from './DescriptionTileSettings'
import FeatureButtonsTileSettings from './FeatureButtonsTileSettings'
import FooterTileSettings from './FooterTileSettings'
import EventCarouselTileSettings from './EventCarouselTileSettings'
import GreetingCardTileSettings from './GreetingCardTileSettings'

interface TileSettingsProps {
  tile: Tile
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  onRemove?: () => void
  eventId: number
  hasRsvp?: boolean
  hasRegistry?: boolean
  forceExpanded?: boolean
}

const TILE_LABELS: Record<TileType, string> = {
  'title': 'Title',
  'image': 'Image',
  'greeting-card': 'Greeting Card',
  'timer': 'Timer',
  'event-details': 'Event Details',
  'description': 'Description',
  'feature-buttons': 'Feature Buttons',
  'footer': 'Footer',
  'event-carousel': 'Event Carousel',
}

export default function TileSettings({ tile, onUpdate, onToggle, onRemove, eventId, hasRsvp = false, hasRegistry = false, forceExpanded = false }: TileSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Sync with forceExpanded prop
  useEffect(() => {
    setIsExpanded(forceExpanded)
  }, [forceExpanded])

  const handleSettingsChange = (settings: any) => {
    onUpdate({
      ...tile,
      settings,
    })
  }

  const renderSettings = () => {
    switch (tile.type) {
      case 'title':
        return (
          <TitleTileSettings
            settings={tile.settings as any}
            onChange={handleSettingsChange}
          />
        )
      case 'image':
        return <ImageTileSettings settings={tile.settings as any} onChange={handleSettingsChange} eventId={eventId} />
      case 'greeting-card':
        return <GreetingCardTileSettings settings={tile.settings as any} onChange={handleSettingsChange} eventId={eventId} />
      case 'timer':
        return <TimerTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'event-details':
        return <EventDetailsTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'description':
        return <DescriptionTileSettings settings={tile.settings as any} onChange={handleSettingsChange} eventId={eventId} />
      case 'feature-buttons':
        return <FeatureButtonsTileSettings settings={tile.settings as any} onChange={handleSettingsChange} hasRsvp={hasRsvp} hasRegistry={hasRegistry} eventId={eventId} />
      case 'footer':
        return <FooterTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'event-carousel':
        return <EventCarouselTileSettings settings={tile.settings as any} onUpdate={handleSettingsChange} eventId={eventId} />
      default:
        return null
    }
  }

  return (
    <div className={`border rounded-lg w-full overflow-x-hidden ${tile.enabled ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
      <div className="flex items-center justify-between p-3 sm:p-4 border-b w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pl-8 sm:pl-10">
            <input
              type="checkbox"
              checked={tile.enabled}
              onChange={(e) => onToggle(tile.id, e.target.checked)}
              className="w-4 h-4 text-eco-green flex-shrink-0 cursor-pointer"
            />
          <h3 className={`font-semibold text-sm sm:text-base truncate min-w-0 ${tile.enabled ? 'text-gray-800' : 'text-gray-500'}`}>
            {TILE_LABELS[tile.type]}
            {!tile.enabled && (
              <span className="text-xs text-gray-400 ml-2 font-normal">(Disabled)</span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
              title="Remove tile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="p-3 sm:p-4 w-full overflow-x-hidden">
          {renderSettings()}
        </div>
      )}
    </div>
  )
}
