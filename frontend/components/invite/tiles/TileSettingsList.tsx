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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // Find indices in the visible tiles list (tilesToRender + footer)
      const visibleTiles = [...tilesToRender, ...(footerTile ? [footerTile] : [])]
      const oldIndexInVisible = visibleTiles.findIndex((t) => t.id === active.id)
      const newIndexInVisible = visibleTiles.findIndex((t) => t.id === over.id)

      if (oldIndexInVisible === -1 || newIndexInVisible === -1) return

      // Don't allow moving footer
      const activeTile = visibleTiles[oldIndexInVisible]
      if (activeTile?.type === 'footer') return

      // Don't allow moving items after footer
      const footerIndexInVisible = visibleTiles.findIndex((t) => t.type === 'footer')
      if (footerIndexInVisible !== -1 && newIndexInVisible >= footerIndexInVisible) return

      // Now find the actual tiles in the full tiles array and reorder
      const activeTileInFull = tiles.find((t) => t.id === active.id)
      const overTileInFull = tiles.find((t) => t.id === over.id)
      
      if (!activeTileInFull || !overTileInFull) return

      const oldIndex = tiles.findIndex((t) => t.id === active.id)
      const newIndex = tiles.findIndex((t) => t.id === over.id)

      const newTiles = arrayMove(tiles, oldIndex, newIndex)
      // Update order values based on the new position
      const reorderedTiles = newTiles.map((tile, index) => ({
        ...tile,
        order: index,
      }))
      onReorder(reorderedTiles)
    }
  }

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

