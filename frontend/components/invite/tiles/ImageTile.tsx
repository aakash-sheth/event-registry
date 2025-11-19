'use client'

import React from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'

interface ImageTileProps {
  settings: ImageTileSettings
  preview?: boolean
  hasTitleOverlay?: boolean
}

export default function ImageTile({ settings, preview = false, hasTitleOverlay = false }: ImageTileProps) {
  if (!settings.src) {
    if (preview) return null
    return (
      <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">No image uploaded</p>
      </div>
    )
  }

  const blurValue = hasTitleOverlay ? (settings.blur || 0) : 0
  const backgroundColor = settings.backgroundColor || '#ffffff'

  const getImageStyle = () => {
    const baseStyle: React.CSSProperties = {
      filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
      maxHeight: '100vh',
    }

    switch (settings.fitMode) {
      case 'fit-to-screen':
        return { ...baseStyle, width: '100%', height: 'auto', objectFit: 'contain' }
      case 'full-image':
        return { ...baseStyle, width: '100%', height: 'auto', objectFit: 'cover' }
      case 'crop-selected-section':
        return { ...baseStyle, width: '100%', height: 'auto', objectFit: 'cover' }
      default:
        return { ...baseStyle, width: '100%', height: 'auto', objectFit: 'cover' }
    }
  }

  if (preview) {
    return (
      <div className="w-full relative max-h-screen overflow-hidden" style={{ backgroundColor }}>
        <img
          src={settings.src}
          alt="Event"
          style={getImageStyle()}
          className="w-full"
        />
      </div>
    )
  }

  return (
    <div className="w-full border rounded-lg overflow-hidden" style={{ backgroundColor }}>
      <img
        src={settings.src}
        alt="Preview"
        className="w-full h-48 object-cover"
      />
    </div>
  )
}

