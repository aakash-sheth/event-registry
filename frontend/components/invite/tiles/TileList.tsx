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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tile } from '@/lib/invite/schema'
import TilePreview from './TilePreview'
import { GripVertical } from 'lucide-react'

interface TileListProps {
  tiles: Tile[]
  onReorder: (tiles: Tile[]) => void
  eventDate?: string
  eventSlug?: string
  eventTitle?: string
  hasRsvp?: boolean
  hasRegistry?: boolean
  allowedSubEvents?: any[]
}

interface SortableTileItemProps {
  tile: Tile
  eventDate?: string
  eventSlug?: string
  eventTitle?: string
  hasRsvp?: boolean
  hasRegistry?: boolean
  allTiles: Tile[]
  isFooter?: boolean
  allowedSubEvents?: any[]
}

function SortableTileItem({
  tile,
  eventDate,
  eventSlug,
  eventTitle,
  hasRsvp,
  hasRegistry,
  allTiles,
  isFooter = false,
  allowedSubEvents = [],
}: SortableTileItemProps) {
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

  if (!tile.enabled) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-full ${isDragging ? 'z-50' : ''}`}
    >
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm mb-4 overflow-hidden w-full max-w-full">
        {!isFooter && (
          <div
            {...attributes}
            {...listeners}
            className="absolute left-2 top-2 z-10 p-1 cursor-grab active:cursor-grabbing bg-white rounded shadow-sm hover:bg-gray-50"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}
        <TilePreview
          tile={tile}
          eventDate={eventDate}
          eventSlug={eventSlug}
          eventTitle={eventTitle}
          hasRsvp={hasRsvp}
          hasRegistry={hasRegistry}
          allTiles={allTiles}
          allowedSubEvents={allowedSubEvents}
        />
      </div>
    </div>
  )
}

interface SortableImageWithOverlayProps {
  imageTile: Tile
  titleTile: Tile
  eventDate?: string
  eventSlug?: string
  eventTitle?: string
  hasRsvp?: boolean
  hasRegistry?: boolean
  allTiles: Tile[]
  allowedSubEvents?: any[]
}

function SortableImageWithOverlay({
  imageTile,
  titleTile,
  eventDate,
  eventSlug,
  eventTitle,
  hasRsvp,
  hasRegistry,
  allTiles,
  allowedSubEvents = [],
}: SortableImageWithOverlayProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: imageTile.id,
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
      className={`relative ${isDragging ? 'z-50' : ''}`}
    >
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm mb-4 overflow-hidden relative w-full max-w-full">
        <div
          {...attributes}
          {...listeners}
          className="absolute left-2 top-2 z-10 p-1 cursor-grab active:cursor-grabbing bg-white rounded shadow-sm hover:bg-gray-50"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <TilePreview
          tile={imageTile}
          eventDate={eventDate}
          eventSlug={eventSlug}
          eventTitle={eventTitle}
          hasRsvp={hasRsvp}
          hasRegistry={hasRegistry}
          allTiles={allTiles}
          allowedSubEvents={allowedSubEvents}
        />
        <TilePreview
          tile={titleTile}
          eventDate={eventDate}
          eventSlug={eventSlug}
          eventTitle={eventTitle}
          hasRsvp={hasRsvp}
          hasRegistry={hasRegistry}
          allTiles={allTiles}
          allowedSubEvents={allowedSubEvents}
        />
      </div>
    </div>
  )
}

export default function TileList({
  tiles,
  onReorder,
  eventDate,
  eventSlug,
  eventTitle,
  hasRsvp,
  hasRegistry,
  allowedSubEvents = [],
}: TileListProps) {
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
        <div className="space-y-0 w-full overflow-x-hidden">
          {tilesToRender.map((tile) => {
            // If this is an image tile with a title overlay, render both together
            const titleOverlay = tiles.find(t => t.type === 'title' && t.overlayTargetId === tile.id)
            
            if (tile.type === 'image' && titleOverlay) {
              return (
                <SortableImageWithOverlay
                  key={tile.id}
                  imageTile={tile}
                  titleTile={titleOverlay}
                  eventDate={eventDate}
                  eventSlug={eventSlug}
                  eventTitle={eventTitle}
                  hasRsvp={hasRsvp}
                  hasRegistry={hasRegistry}
                  allTiles={tiles}
                  allowedSubEvents={allowedSubEvents}
                />
              )
            }

            return (
              <SortableTileItem
                key={tile.id}
                tile={tile}
                eventDate={eventDate}
                eventSlug={eventSlug}
                eventTitle={eventTitle}
                hasRsvp={hasRsvp}
                hasRegistry={hasRegistry}
                allTiles={tiles}
              />
            )
          })}
          {footerTile && (
            <SortableTileItem
              key={footerTile.id}
              tile={footerTile}
              eventDate={eventDate}
              eventSlug={eventSlug}
              eventTitle={eventTitle}
              hasRsvp={hasRsvp}
              hasRegistry={hasRegistry}
              allTiles={tiles}
              isFooter={true}
              allowedSubEvents={allowedSubEvents}
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}

