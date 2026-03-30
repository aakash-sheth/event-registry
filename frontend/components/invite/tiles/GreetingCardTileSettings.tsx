'use client'

import React, { useState } from 'react'
import type { GreetingCardTileSettings } from '@/lib/invite/schema'
import { Button } from '@/components/ui/button'
import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'
import { uploadImage } from '@/lib/api'
import type { TextOverlay } from '@/lib/invite/api'
import GreetingCardMediaPicker from '@/components/invite/GreetingCardMediaPicker'
import TextOverlayEditorModal from '@/components/invite/TextOverlayEditorModal'

interface GreetingCardTileSettingsProps {
  settings: GreetingCardTileSettings
  onChange: (settings: GreetingCardTileSettings) => void
  eventId: number
}

const PRESET_GRADIENTS = [
  { label: 'Rose Blush',    value: 'linear-gradient(135deg, #fce4ec, #f48fb1)' },
  { label: 'Sage Mist',     value: 'linear-gradient(135deg, #e8f5e9, #81c784)' },
  { label: 'Dusk Blue',     value: 'linear-gradient(135deg, #e3f2fd, #64b5f6)' },
  { label: 'Golden Hour',   value: 'linear-gradient(135deg, #fff8e1, #ffca28)' },
  { label: 'Lavender',      value: 'linear-gradient(135deg, #f3e5f5, #ce93d8)' },
  { label: 'Peach Cream',   value: 'linear-gradient(135deg, #fff3e0, #ffb74d)' },
  { label: 'Midnight',      value: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  { label: 'Forest',        value: 'linear-gradient(135deg, #1b4332, #40916c)' },
]

export default function GreetingCardTileSettings({ settings, onChange, eventId }: GreetingCardTileSettingsProps) {
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [overlayEditorOpen, setOverlayEditorOpen] = useState(false)

  const hasContent = !!settings.src || !!settings.backgroundGradient

  const handleMediaSelect = (src: string, textOverlays: TextOverlay[]) => {
    onChange({
      ...settings,
      src,
      textOverlays: textOverlays.length > 0 ? textOverlays : settings.textOverlays,
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    setUploading(true)
    try {
      const imageUrl = await uploadImage(file, eventId)
      onChange({ ...settings, src: imageUrl })

      // Extract dominant color asynchronously and store as backgroundGradient fallback
      extractDominantColors(imageUrl, 1)
        .then((colors) => {
          const primaryColor = rgbToHex(colors[0] || 'rgb(0,0,0)')
          onChange({ ...settings, src: imageUrl, backgroundGradient: primaryColor })
        })
        .catch(() => {
          // Non-critical — image is already set
        })
    } catch {
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Edit card design button — shown when there is content to edit */}
      {hasContent && (
        <button
          type="button"
          onClick={() => setOverlayEditorOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          <span>Edit card design</span>
        </button>
      )}

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium mb-2">Upload Image</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-eco-green file:text-white hover:file:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-1">
          {uploading ? 'Uploading...' : 'JPG, PNG, WEBP (max 5MB)'}
        </p>
      </div>

      {/* Media Library */}
      <div>
        <p className="text-xs text-gray-400 text-center mb-2">or</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setPickerOpen(true)}
        >
          Browse Media Library
        </Button>
      </div>

      <GreetingCardMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleMediaSelect}
      />

      <TextOverlayEditorModal
        open={overlayEditorOpen}
        bgSrc={settings.src}
        initialOverlays={settings.textOverlays ?? []}
        onSave={(overlays) => onChange({ ...settings, textOverlays: overlays })}
        onClose={() => setOverlayEditorOpen(false)}
      />

      {/* Gradient background presets — shown when no image */}
      {!settings.src && (
        <div>
          <label className="block text-sm font-medium mb-2">Background Color / Gradient</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESET_GRADIENTS.map((g) => (
              <button
                key={g.value}
                type="button"
                title={g.label}
                onClick={() => onChange({ ...settings, backgroundGradient: g.value })}
                className="h-10 rounded-lg border-2 transition-all"
                style={{
                  background: g.value,
                  borderColor: settings.backgroundGradient === g.value ? '#3b82f6' : 'transparent',
                }}
              />
            ))}
          </div>
          <input
            type="text"
            value={settings.backgroundGradient || ''}
            onChange={(e) => onChange({ ...settings, backgroundGradient: e.target.value })}
            placeholder="linear-gradient(135deg, #fce4ec, #f48fb1)"
            className="w-full text-xs border rounded px-3 py-2 font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">Custom CSS gradient or solid hex color</p>
        </div>
      )}

      {/* Remove image button */}
      {settings.src && (
        <Button
          onClick={() => onChange({ ...settings, src: undefined })}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Remove Image
        </Button>
      )}
    </div>
  )
}
