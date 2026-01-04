'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Tile } from '@/lib/invite/schema'
import TileSettings from './TileSettings'

interface SortableTileSettingsProps {
  tile: Tile
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  allTiles?: Tile[]
  onOverlayToggle?: (tileId: string, targetTileId: string | undefined) => void
  eventId: number
  hasRsvp?: boolean
  hasRegistry?: boolean
  forceExpanded?: boolean
  isFooter?: boolean
}

export default function SortableTileSettings({
  tile,
  onUpdate,
  onToggle,
  allTiles = [],
  onOverlayToggle,
  eventId,
  hasRsvp = false,
  hasRegistry = false,
  forceExpanded = false,
  isFooter = false,
}: SortableTileSettingsProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tile.id,
    disabled: isFooter, // Footer is not draggable
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-full ${isDragging ? 'z-50' : ''}`}
    >
      <div className="relative">
        {!isFooter && (
          <div
            {...attributes}
            {...listeners}
            className="absolute left-2 top-3 z-10 p-1 cursor-grab active:cursor-grabbing bg-white rounded shadow-sm hover:bg-gray-50 border border-gray-200"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}
        <TileSettings
          tile={tile}
          onUpdate={onUpdate}
          onToggle={onToggle}
          allTiles={allTiles}
          onOverlayToggle={onOverlayToggle}
          eventId={eventId}
          hasRsvp={hasRsvp}
          hasRegistry={hasRegistry}
          forceExpanded={forceExpanded}
          isDragging={isDragging}
          dragHandleProps={!isFooter ? { ...attributes, ...listeners } : undefined}
        />
      </div>
    </div>
  )
}

