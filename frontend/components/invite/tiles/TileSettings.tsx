'use client'

import React, { useState } from 'react'
import { Tile, TileType } from '@/lib/invite/schema'
import { ChevronDown, ChevronUp } from 'lucide-react'
import TitleTileSettings from './TitleTileSettings'
import ImageTileSettings from './ImageTileSettings'
import TimerTileSettings from './TimerTileSettings'
import EventDetailsTileSettings from './EventDetailsTileSettings'
import DescriptionTileSettings from './DescriptionTileSettings'
import FeatureButtonsTileSettings from './FeatureButtonsTileSettings'
import FooterTileSettings from './FooterTileSettings'

interface TileSettingsProps {
  tile: Tile
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  allTiles?: Tile[]
  onOverlayToggle?: (tileId: string, targetTileId: string | undefined) => void
}

const TILE_LABELS: Record<TileType, string> = {
  'title': 'Title',
  'image': 'Image',
  'timer': 'Timer',
  'event-details': 'Event Details',
  'description': 'Description',
  'feature-buttons': 'Feature Buttons',
  'footer': 'Footer',
}

export default function TileSettings({ tile, onUpdate, onToggle, allTiles = [], onOverlayToggle }: TileSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

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
        return <ImageTileSettings settings={tile.settings as any} onChange={handleSettingsChange} hasTitleOverlay={hasTitleOverlay} />
      case 'timer':
        return <TimerTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'event-details':
        return <EventDetailsTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'description':
        return <DescriptionTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'feature-buttons':
        return <FeatureButtonsTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      case 'footer':
        return <FooterTileSettings settings={tile.settings as any} onChange={handleSettingsChange} />
      default:
        return null
    }
  }

  // Title tile is mandatory and cannot be disabled
  const isTitleTile = tile.type === 'title'
  const isMandatory = isTitleTile || tile.type === 'event-details'

  return (
    <div className="border rounded-lg bg-white w-full overflow-x-hidden">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {isMandatory ? (
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-eco-green font-bold">*</span>
            </div>
          ) : (
            <input
              type="checkbox"
              checked={tile.enabled}
              onChange={(e) => onToggle(tile.id, e.target.checked)}
              className="w-4 h-4 text-eco-green flex-shrink-0"
            />
          )}
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate min-w-0">
            {TILE_LABELS[tile.type]}
            {isMandatory && <span className="text-red-500 ml-1">*</span>}
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

