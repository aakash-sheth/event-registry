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

  // Include all tiles - don't filter out title tiles in overlay mode
  // This allows users to access and edit title tiles even when they're overlaying on images
  const tilesToRender = otherTiles

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
      
      // Calculate previewOrder based on the actual position in the reordered array
      // This matches what the user sees in the settings panel (all tiles, enabled or disabled)
      // Include ALL tiles in ordering calculation (overlay titles will get same order as their target)
      const tilesForOrdering = newTiles.filter(tile => {
        // Include all tiles except overlay titles (they'll get assigned order from their target)
        if (tile.type === 'title' && tile.overlayTargetId) return false
        return true
      })
      
      // Create previewOrder map based on position in reordered array
      const previewOrderMap = new Map<string, number>()
      tilesForOrdering.forEach((tile, index) => {
        previewOrderMap.set(tile.id, index)
        // Overlay titles get same previewOrder as their target image
        const overlayTitle = newTiles.find(t => t.type === 'title' && t.overlayTargetId === tile.id)
        if (overlayTitle) {
          previewOrderMap.set(overlayTitle.id, index)
        }
      })
      
      // CRITICAL: Ensure ALL tiles get a previewOrder (including overlay titles and any missed tiles)
      // Update tiles with previewOrder (but keep saved order unchanged)
      const reorderedTiles = newTiles.map((tile) => {
        // First check if this tile already has previewOrder in map
        let previewOrder = previewOrderMap.get(tile.id)
        
        // If overlay title, get order from its target
        if (tile.type === 'title' && tile.overlayTargetId) {
          const targetTile = newTiles.find(t => t.id === tile.overlayTargetId)
          if (targetTile) {
            previewOrder = previewOrderMap.get(targetTile.id)
          }
        }
        
        // If still no previewOrder, use existing or fallback to order
        if (previewOrder === undefined) {
          previewOrder = tile.previewOrder ?? tile.order ?? 0
        }
        
        return { ...tile, previewOrder }
      })
      
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

