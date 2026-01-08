'use client'

import React, { useState, useEffect } from 'react'
import { Tile, TileType } from '@/lib/invite/schema'
import { ChevronDown, ChevronUp } from 'lucide-react'
import TitleTileSettings from './TitleTileSettings'
import ImageTileSettings from './ImageTileSettings'
import TimerTileSettings from './TimerTileSettings'
import EventDetailsTileSettings from './EventDetailsTileSettings'
import DescriptionTileSettings from './DescriptionTileSettings'
import FeatureButtonsTileSettings from './FeatureButtonsTileSettings'
import FooterTileSettings from './FooterTileSettings'
import EventCarouselTileSettings from './EventCarouselTileSettings'

interface TileSettingsProps {
  tile: Tile
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  allTiles?: Tile[]
  onOverlayToggle?: (tileId: string, targetTileId: string | undefined) => void
  eventId: number
  hasRsvp?: boolean
  hasRegistry?: boolean
  forceExpanded?: boolean
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

const TILE_LABELS: Record<TileType, string> = {
  'title': 'Title',
  'image': 'Image',
  'timer': 'Timer',
  'event-details': 'Event Details',
  'description': 'Description',
  'feature-buttons': 'Feature Buttons',
  'footer': 'Footer',
  'event-carousel': 'Event Carousel',
}

export default function TileSettings({ tile, onUpdate, onToggle, allTiles = [], onOverlayToggle, eventId, hasRsvp = false, hasRegistry = false, forceExpanded = false, isDragging = false, dragHandleProps }: TileSettingsProps) {
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

  const handleOverlayToggle = (targetTileId: string | undefined) => {
    if (onOverlayToggle) {
      onOverlayToggle(tile.id, targetTileId)
    } else {
      // Fallback: update settings directly
      handleSettingsChange({
        ...tile.settings,
        overlayMode: !!targetTileId,
        overlayPosition: targetTileId ? ((tile.settings as any).overlayPosition || { x: 50, y: 50 }) : undefined,
      })
      // Update overlayTargetId
      onUpdate({
        ...tile,
        overlayTargetId: targetTileId,
        settings: {
          ...tile.settings,
          overlayMode: !!targetTileId,
          overlayPosition: targetTileId ? ((tile.settings as any).overlayPosition || { x: 50, y: 50 }) : undefined,
        },
      })
    }
  }

  const renderSettings = () => {
    switch (tile.type) {
      case 'title':
        return (
          <TitleTileSettings
            settings={tile.settings as any}
            onChange={handleSettingsChange}
            tile={tile}
            allTiles={allTiles}
            onOverlayToggle={handleOverlayToggle}
          />
        )
      case 'image':
        const hasTitleOverlay = allTiles.some(t => t.type === 'title' && t.overlayTargetId === tile.id)
        return <ImageTileSettings settings={tile.settings as any} onChange={handleSettingsChange} hasTitleOverlay={hasTitleOverlay} eventId={eventId} />
      case 'timer':
        return <TimerTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'event-details':
        return <EventDetailsTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'description':
        return <DescriptionTileSettings settings={tile.settings as any} onChange={handleSettingsChange} eventId={eventId} />
      case 'feature-buttons':
        return <FeatureButtonsTileSettings settings={tile.settings as any} onChange={handleSettingsChange} hasRsvp={hasRsvp} hasRegistry={hasRegistry} />
      case 'footer':
        return <FooterTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'event-carousel':
        return <EventCarouselTileSettings settings={tile.settings as any} onUpdate={handleSettingsChange} />
      default:
        return null
    }
  }

  // Title tile is mandatory only if no valid image tile exists
  const isTitleTile = tile.type === 'title'
  const enabledImageTiles = allTiles.filter(t => t.type === 'image' && t.enabled)
  const hasValidImageTile = enabledImageTiles.some(t => {
    const imageSettings = t.settings as any
    return imageSettings?.src && imageSettings.src.trim() !== ''
  })
  // Title is mandatory only if there's no valid enabled image tile
  // Event details is always mandatory
  const isMandatory = (isTitleTile && !hasValidImageTile) || tile.type === 'event-details'

  return (
    <div className={`border rounded-lg w-full overflow-x-hidden ${tile.enabled || isMandatory ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
      <div className="flex items-center justify-between p-3 sm:p-4 border-b w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pl-8 sm:pl-10">
          {isMandatory ? (
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-eco-green font-bold">*</span>
            </div>
          ) : (
            <input
              type="checkbox"
              checked={tile.enabled}
              onChange={(e) => onToggle(tile.id, e.target.checked)}
              className="w-4 h-4 text-eco-green flex-shrink-0 cursor-pointer"
            />
          )}
          <h3 className={`font-semibold text-sm sm:text-base truncate min-w-0 ${tile.enabled || isMandatory ? 'text-gray-800' : 'text-gray-500'}`}>
            {TILE_LABELS[tile.type]}
            {isMandatory && <span className="text-red-500 ml-1">*</span>}
            {tile.type === 'title' && tile.overlayTargetId && (
              <span className="text-xs text-blue-600 ml-2 font-normal">(Overlaying on Image)</span>
            )}
            {tile.type === 'title' && hasValidImageTile && !isMandatory && (
              <span className="text-xs text-gray-500 ml-2 font-normal">(Optional - Image present)</span>
            )}
            {!tile.enabled && !isMandatory && (
              <span className="text-xs text-gray-400 ml-2 font-normal">(Disabled)</span>
            )}
          </h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
      </div>
      {isExpanded && (
        <div className="p-3 sm:p-4 w-full overflow-x-hidden">
          {renderSettings()}
        </div>
      )}
    </div>
  )
}

