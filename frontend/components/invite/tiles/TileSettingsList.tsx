'use client'

import React from 'react'
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
import { Tile } from '@/lib/invite/schema'
import SortableTileSettings from './SortableTileSettings'

interface TileSettingsListProps {
  tiles: Tile[]
  onReorder: (tiles: Tile[]) => void
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  onOverlayToggle?: (tileId: string, targetTileId: string | undefined) => void
  eventId: number
  hasRsvp?: boolean
  hasRegistry?: boolean
  forceExpanded?: boolean
}

export default function TileSettingsList({
  tiles,
  onReorder,
  onUpdate,
  onToggle,
  onOverlayToggle,
  eventId,
  hasRsvp = false,
  hasRegistry = false,
  forceExpanded = false,
}: TileSettingsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tiles.findIndex((t) => t.id === active.id)
      const newIndex = tiles.findIndex((t) => t.id === over.id)

      // Don't allow moving footer
      const activeTile = tiles[oldIndex]
      if (activeTile?.type === 'footer') return

      // Don't allow moving items after footer
      const footerIndex = tiles.findIndex((t) => t.type === 'footer')
      if (footerIndex !== -1 && newIndex >= footerIndex) return

      const newTiles = arrayMove(tiles, oldIndex, newIndex)
      // Update order values
      const reorderedTiles = newTiles.map((tile, index) => ({
        ...tile,
        order: index,
      }))
      onReorder(reorderedTiles)
    }
  }

  // Separate footer from other tiles
  const footerTile = tiles.find((t) => t.type === 'footer')
  const otherTiles = tiles.filter((t) => t.type !== 'footer')

  // Filter out title tiles that are in overlay mode (they'll be rendered with their image)
  const tilesToRender = otherTiles.filter(tile => {
    if (tile.type === 'title' && tile.overlayTargetId) {
      // Don't render title separately if it's overlaid on an image
      return false
    }
    return true
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tilesToRender.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 w-full">
          {tilesToRender.map((tile) => (
            <SortableTileSettings
              key={tile.id}
              tile={tile}
              onUpdate={onUpdate}
              onToggle={onToggle}
              allTiles={tiles}
              onOverlayToggle={onOverlayToggle}
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
              allTiles={tiles}
              onOverlayToggle={onOverlayToggle}
              eventId={eventId}
              hasRsvp={hasRsvp}
              hasRegistry={hasRegistry}
              forceExpanded={forceExpanded}
              isFooter={true}
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}

