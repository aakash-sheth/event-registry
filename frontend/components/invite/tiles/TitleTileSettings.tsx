'use client'

import React from 'react'
import { TitleTileSettings, Tile } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TitleTileSettingsProps {
  settings: TitleTileSettings
  onChange: (settings: TitleTileSettings) => void
  tile?: Tile
  allTiles?: Tile[]
  onOverlayToggle?: (targetTileId: string | undefined) => void
}

export default function TitleTileSettings({ 
  settings, 
  onChange, 
  tile,
  allTiles = [],
  onOverlayToggle,
}: TitleTileSettingsProps) {
  const imageTiles = allTiles.filter(t => t.type === 'image' && t.enabled)
  const isOverlayMode = settings.overlayMode || false
  const currentOverlayTarget = tile?.overlayTargetId

  const handleOverlayToggle = (imageTileId: string | undefined) => {
    if (onOverlayToggle) {
      onOverlayToggle(imageTileId)
    } else {
      onChange({
        ...settings,
        overlayMode: !!imageTileId,
        overlayPosition: imageTileId ? (settings.overlayPosition || { x: 50, y: 50 }) : undefined,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Title Text *</label>
        <Input
          value={settings.text || ''}
          onChange={(e) => onChange({ ...settings, text: e.target.value })}
          placeholder="Event Title"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Font</label>
        <select
          value={FONT_OPTIONS.find(f => f.family === settings.font)?.id || FONT_OPTIONS[0].id}
          onChange={(e) => {
            const font = FONT_OPTIONS.find(f => f.id === e.target.value)
            onChange({ ...settings, font: font?.family })
          }}
          className="w-full text-sm border rounded px-3 py-2"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.name} ({font.category})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Preview: <span style={{ fontFamily: settings.font || FONT_OPTIONS[0].family }}>{settings.text || 'Event Title'}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.color || '#000000'}
            onChange={(e) => onChange({ ...settings, color: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.color || '#000000'}
            onChange={(e) => onChange({ ...settings, color: e.target.value })}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Title Size</label>
        <select
          value={settings.size || 'medium'}
          onChange={(e) => onChange({ ...settings, size: e.target.value as 'small' | 'medium' | 'large' | 'xlarge' })}
          className="w-full text-sm border rounded px-3 py-2"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xlarge">Extra Large</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Preview size: {settings.size || 'medium'}
        </p>
      </div>

      {imageTiles.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">Overlay on Image</label>
          <div className="space-y-2">
            <Button
              type="button"
              variant={currentOverlayTarget ? "default" : "outline"}
              size="sm"
              onClick={() => handleOverlayToggle(currentOverlayTarget ? undefined : imageTiles[0].id)}
              className="w-full"
            >
              {currentOverlayTarget ? 'Remove Overlay' : `Overlay on Image Tile`}
            </Button>
            {currentOverlayTarget && (
              <div className="p-3 bg-gray-50 rounded border">
                <p className="text-xs text-gray-600 mb-3">Position within image:</p>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-600 font-medium">Horizontal Position (X)</label>
                      <span className="text-xs text-gray-500 font-mono">{settings.overlayPosition?.x || 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.overlayPosition?.x || 50}
                      onChange={(e) => onChange({
                        ...settings,
                        overlayPosition: {
                          x: parseInt(e.target.value) || 50,
                          y: settings.overlayPosition?.y || 50,
                        },
                      })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${settings.overlayPosition?.x || 50}%, #e5e7eb ${settings.overlayPosition?.x || 50}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-600 font-medium">Vertical Position (Y)</label>
                      <span className="text-xs text-gray-500 font-mono">{settings.overlayPosition?.y || 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.overlayPosition?.y || 50}
                      onChange={(e) => onChange({
                        ...settings,
                        overlayPosition: {
                          x: settings.overlayPosition?.x || 50,
                          y: parseInt(e.target.value) || 50,
                        },
                      })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${settings.overlayPosition?.y || 50}%, #e5e7eb ${settings.overlayPosition?.y || 50}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

