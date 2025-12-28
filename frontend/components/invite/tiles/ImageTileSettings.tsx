'use client'

import React, { useState, useEffect } from 'react'
import type { ImageTileSettings } from '@/lib/invite/schema'
import { Button } from '@/components/ui/button'
import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'
import { uploadImage } from '@/lib/api'

interface ImageTileSettingsProps {
  settings: ImageTileSettings
  onChange: (settings: ImageTileSettings) => void
  hasTitleOverlay?: boolean
  eventId: number
}

// iPhone 16 aspect ratio: 1179:2556
const IPHONE_ASPECT_RATIO = 1179 / 2556
const ASPECT_RATIO_TOLERANCE = 0.01 // Allow small tolerance for floating point comparison

export default function ImageTileSettings({ settings, onChange, hasTitleOverlay = false, eventId }: ImageTileSettingsProps) {
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  // Detect image aspect ratio when image loads
  useEffect(() => {
    if (!settings.src) {
      setImageAspectRatio(null)
      return
    }

    const img = new Image()
    img.onload = () => {
      const aspectRatio = img.width / img.height
      setImageAspectRatio(aspectRatio)
    }
    img.onerror = () => {
      setImageAspectRatio(null)
    }
    img.src = settings.src
  }, [settings.src])

  // Check if image aspect ratio matches iPhone aspect ratio
  const matchesMobileAspectRatio = imageAspectRatio !== null && 
    Math.abs(imageAspectRatio - IPHONE_ASPECT_RATIO) < ASPECT_RATIO_TOLERANCE
  
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
      // Upload file to S3 (or local storage in development)
      const imageUrl = await uploadImage(file, eventId)
      
      // Update UI immediately with uploaded image (don't wait for color extraction)
      onChange({ ...settings, src: imageUrl })
      
      // Extract dominant color for background asynchronously (non-blocking)
      // This happens in the background and updates the background color when ready
      extractDominantColors(imageUrl, 3)
        .then((colors) => {
        const primaryColor = rgbToHex(colors[0] || 'rgb(0,0,0)')
        onChange({
          ...settings,
          src: imageUrl,
          backgroundColor: primaryColor,
        })
        })
        .catch((error) => {
          console.error('Error extracting dominant colors (non-critical):', error)
          // Color extraction failed, but image is already uploaded and displayed
          // User can manually set background color if needed
        })
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden min-w-0">
      <div>
        <label className="block text-sm font-medium mb-2">Image Upload</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-eco-green file:text-white hover:file:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-500 mt-1">
          {uploading ? 'Uploading...' : 'Supported: JPG, PNG, WEBP (max 5MB)'}
        </p>
      </div>

      {settings.src && (
        <>
          {/* 2. Fit Mode */}
          <div>
            <label className="block text-sm font-medium mb-2">Fit Mode</label>
            <select
              value={settings.fitMode || 'fit-to-screen'}
              onChange={(e) => onChange({ ...settings, fitMode: e.target.value as any })}
              className="w-full text-sm border rounded px-3 py-2"
            >
              <option value="fit-to-screen">Fit to Screen</option>
              <option value="full-image">Cover Image</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              <strong>Fit to Screen:</strong> Shows entire image without cropping. 
              <strong> Cover Image:</strong> Fills container with position control.
            </p>
          </div>

          {/* 3. Background Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                placeholder="#FFFFFF"
                className="flex-1 text-sm border rounded px-3 py-2"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Used when image doesn't fill the screen</p>
          </div>

          {/* 4. Image Position (visible only when cover image is selected) */}
          {settings.fitMode === 'full-image' && (
            <div>
              <label className="block text-sm font-medium mb-2">Image Position</label>
              <p className="text-xs text-gray-500 mb-2">
                Adjust which part of the image is visible. The preview below updates in real-time. 
                This position will be saved and displayed on your desktop site.
              </p>
              <select
                value={
                  typeof settings.coverPosition === 'object' 
                    ? 'custom' 
                    : (settings.coverPosition || 'center')
                }
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'custom') {
                    // Default to center if switching to custom
                    onChange({ ...settings, coverPosition: { x: 50, y: 50 } })
                  } else {
                    onChange({ ...settings, coverPosition: value as any })
                  }
                }}
                className="w-full text-sm border rounded px-3 py-2 mb-3"
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="custom">Custom Position (Fine-tune)</option>
              </select>
              {typeof settings.coverPosition === 'object' && settings.coverPosition !== null && 'x' in settings.coverPosition && (
                <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded border">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Horizontal Position
                      </label>
                      <span className="text-xs font-semibold text-gray-600">{settings.coverPosition.x}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.coverPosition.x}
                      onChange={(e) => {
                        const currentPos = settings.coverPosition
                        if (typeof currentPos === 'object' && currentPos !== null && 'x' in currentPos) {
                          onChange({
                            ...settings,
                            coverPosition: { x: parseInt(e.target.value), y: currentPos.y }
                          })
                        }
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Left</span>
                      <span>Right</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Vertical Position
                      </label>
                      <span className="text-xs font-semibold text-gray-600">{settings.coverPosition.y}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.coverPosition.y}
                      onChange={(e) => {
                        const currentPos = settings.coverPosition
                        if (typeof currentPos === 'object' && currentPos !== null && 'x' in currentPos) {
                          onChange({
                            ...settings,
                            coverPosition: { x: currentPos.x, y: parseInt(e.target.value) }
                          })
                        }
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Top</span>
                      <span>Bottom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Live Preview (image preview for image positioning) */}
          {settings.fitMode === 'full-image' && (
            <>
              <div 
                className="border-2 border-gray-300 rounded-lg overflow-hidden relative w-full" 
                style={{ 
                  minHeight: '250px', 
                  maxHeight: '300px',
                  aspectRatio: matchesMobileAspectRatio && imageAspectRatio ? `${imageAspectRatio}` : '16/9',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: matchesMobileAspectRatio ? 'transparent' : (settings.backgroundColor || '#ffffff'),
                }}
              >
                <img 
                  src={settings.src} 
                  alt="Preview" 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: (() => {
                      if (!settings.coverPosition || settings.coverPosition === 'center') {
                        return 'center center'
                      }
                      if (typeof settings.coverPosition === 'object') {
                        return `${settings.coverPosition.x}% ${settings.coverPosition.y}%`
                      }
                      const positionMap: Record<string, string> = {
                        'top': 'center top',
                        'bottom': 'center bottom',
                        'left': 'left center',
                        'right': 'right center',
                        'top-left': 'left top',
                        'top-right': 'right top',
                        'bottom-left': 'left bottom',
                        'bottom-right': 'right bottom',
                      }
                      return positionMap[settings.coverPosition] || 'center center'
                    })(),
                    display: 'block',
                  }}
                />
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: `
                    linear-gradient(to right, transparent 0%, transparent calc(50% - 1px), rgba(255,255,255,0.3) 50%, transparent calc(50% + 1px), transparent 100%),
                    linear-gradient(to bottom, transparent 0%, transparent calc(50% - 1px), rgba(255,255,255,0.3) 50%, transparent calc(50% + 1px), transparent 100%)
                  `
                }} />
              </div>
              <div className="mt-2">
                <p className="text-xs text-gray-600 text-center font-medium">
                  Live Preview - Adjust position to see changes
                </p>
                <p className="text-xs text-gray-500 text-center mt-1">
                  The crosshair shows the center point. Move the position to see different parts of your image.
                </p>
              </div>
            </>
          )}

          {/* Preview for fit-to-screen mode */}
          {settings.fitMode === 'fit-to-screen' && settings.src && (
            <div 
              className="border-2 border-gray-300 rounded-lg overflow-hidden relative w-full flex items-center justify-center" 
              style={{ 
                minHeight: '200px', 
                maxHeight: '300px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                backgroundColor: matchesMobileAspectRatio ? 'transparent' : (settings.backgroundColor || '#ffffff'),
                aspectRatio: matchesMobileAspectRatio ? `${imageAspectRatio}` : undefined,
              }}
            >
              <img 
                src={settings.src} 
                alt="Preview" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: matchesMobileAspectRatio ? '100%' : 'auto',
                  height: matchesMobileAspectRatio ? '100%' : 'auto',
                  objectFit: matchesMobileAspectRatio ? 'cover' : 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Blur (when title overlay is active) */}
          {hasTitleOverlay && (
            <div>
              <label className="block text-sm font-medium mb-2">Blur (when title overlay is active)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.blur || 0}
                onChange={(e) => onChange({ ...settings, blur: parseInt(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Blur value: {settings.blur || 0}</p>
            </div>
          )}

          {/* 6. Remove Button */}
          <div className="flex gap-2">
            <Button
              onClick={() => onChange({ ...settings, src: undefined })}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Remove Image
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

