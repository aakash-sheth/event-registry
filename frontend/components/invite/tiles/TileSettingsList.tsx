'use client'

import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus, X } from 'lucide-react'
import { Tile, TileType } from '@/lib/invite/schema'
import SortableTileSettings from './SortableTileSettings'

// All available tile types with descriptions for the picker
const TILE_CATALOG: { type: TileType; label: string; description: string }[] = [
  { type: 'title',           label: 'Title',           description: 'Your event name and subtitle' },
  { type: 'image',           label: 'Greeting',        description: 'A greeting card or hero photo' },
  { type: 'event-details',   label: 'Event Details',   description: 'Date, time, and location' },
  { type: 'description',     label: 'Description',     description: 'A message or story about your event' },
  { type: 'timer',           label: 'Timer',           description: 'Countdown clock to your event' },
  { type: 'feature-buttons', label: 'Feature Buttons', description: 'RSVP and registry links' },
  { type: 'event-carousel',  label: 'Event Carousel',  description: 'Showcase multiple sub-events' },
  { type: 'footer',          label: 'Footer',          description: 'Closing note and contact info' },
]

interface TileSettingsListProps {
  tiles: Tile[]
  onReorder: (tiles: Tile[]) => void
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  onOverlayToggle?: (tileId: string, targetTileId: string | undefined) => void
  onAddTile?: (type: TileType) => void
  onRemoveTile?: (tileId: string) => void
  eventId: number
  hasRsvp?: boolean
  hasRegistry?: boolean
  forceExpanded?: boolean
  eventStructure?: 'SIMPLE' | 'ENVELOPE'
}

export default function TileSettingsList({
  tiles,
  onReorder,
  onUpdate,
  onToggle,
  onAddTile,
  onRemoveTile,
  eventId,
  hasRsvp = false,
  hasRegistry = false,
  forceExpanded = false,
  eventStructure,
}: TileSettingsListProps) {
  const [showPicker, setShowPicker] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const footerTile = tiles.find((t) => t.type === 'footer')
  const otherTiles = tiles.filter((t) => t.type !== 'footer')

  // Tile types already present in the config
  const presentTypes = new Set(tiles.map((t) => t.type))

  // Tile types available to add (not yet present; event-carousel only for ENVELOPE events)
  const availableToAdd = TILE_CATALOG.filter((c) => {
    if (presentTypes.has(c.type)) return false
    if (c.type === 'event-carousel' && eventStructure !== 'ENVELOPE') return false
    return true
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const visibleTiles = [...otherTiles, ...(footerTile ? [footerTile] : [])]
      const oldIndexInVisible = visibleTiles.findIndex((t) => t.id === active.id)
      const newIndexInVisible = visibleTiles.findIndex((t) => t.id === over.id)
      if (oldIndexInVisible === -1 || newIndexInVisible === -1) return
      if (visibleTiles[oldIndexInVisible]?.type === 'footer') return
      const footerIndexInVisible = visibleTiles.findIndex((t) => t.type === 'footer')
      if (footerIndexInVisible !== -1 && newIndexInVisible >= footerIndexInVisible) return
      const oldIndex = tiles.findIndex((t) => t.id === active.id)
      const newIndex = tiles.findIndex((t) => t.id === over.id)
      const newTiles = arrayMove(tiles, oldIndex, newIndex)
      const reorderedTiles = newTiles.map((tile, index) => ({ ...tile, previewOrder: index }))
      onReorder(reorderedTiles)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={otherTiles.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 w-full">
          {otherTiles.map((tile) => (
            <SortableTileSettings
              key={tile.id}
              tile={tile}
              onUpdate={onUpdate}
              onToggle={onToggle}
              onRemove={onRemoveTile ? () => onRemoveTile(tile.id) : undefined}
              eventId={eventId}
              hasRsvp={hasRsvp}
              hasRegistry={hasRegistry}
              forceExpanded={forceExpanded}
            />
          ))}
          {footerTile && (
            <SortableTileSettings
              key={footerTile.id}
              tile={footerTile}
              onUpdate={onUpdate}
              onToggle={onToggle}
              onRemove={onRemoveTile ? () => onRemoveTile(footerTile.id) : undefined}
              eventId={eventId}
              hasRsvp={hasRsvp}
              hasRegistry={hasRegistry}
              forceExpanded={forceExpanded}
              isFooter={true}
            />
          )}

          {/* Add tile */}
          {onAddTile && availableToAdd.length > 0 && (
            <div className="pt-1">
              {!showPicker ? (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-2 text-sm text-eco-green hover:text-green-700 font-medium py-2 px-1 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add a tile
                </button>
              ) : (
                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">Choose a tile to add</span>
                    <button
                      type="button"
                      onClick={() => setShowPicker(false)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {availableToAdd.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => {
                          onAddTile(item.type)
                          setShowPicker(false)
                        }}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        </div>
                        <Plus className="w-4 h-4 text-eco-green flex-shrink-0 ml-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}
