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
      className={`relative ${isDragging ? 'z-50' : ''}`}
    >
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm mb-4 overflow-hidden">
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
      <div className="bg-white rounded-lg border-2 border-gray-200 shadow-sm mb-4 overflow-hidden relative">
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
        />
        <TilePreview
          tile={titleTile}
          eventDate={eventDate}
          eventSlug={eventSlug}
          eventTitle={eventTitle}
          hasRsvp={hasRsvp}
          hasRegistry={hasRegistry}
          allTiles={allTiles}
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
}: TileListProps) {
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
        <div className="space-y-0">
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
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  )
}

