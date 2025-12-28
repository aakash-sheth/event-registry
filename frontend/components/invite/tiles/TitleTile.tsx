'use client'

import React from 'react'
import { TitleTileSettings, Tile } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

export interface TitleTileProps {
  settings: TitleTileSettings
  preview?: boolean
  overlayMode?: boolean
  overlayTargetTile?: Tile
}

export default function TitleTile({ settings, preview = false, overlayMode = false, overlayTargetTile }: TitleTileProps) {
  const fontFamily = settings.font || FONT_OPTIONS[0].family
  const color = settings.color || '#000000'
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'

  // Size classes mapping
  const sizeClasses = {
    small: 'text-xl md:text-2xl',
    medium: 'text-3xl md:text-4xl',
    large: 'text-4xl md:text-5xl',
    xlarge: 'text-5xl md:text-6xl',
  }

  const titleClassName = sizeClasses[size]

  if (preview) {
    if (overlayMode && overlayTargetTile) {
      // Overlay mode - position within image
      const position = settings.overlayPosition || { x: 50, y: 50 }
      return (
        <div
          className="absolute z-10"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
            fontFamily,
            color,
            textAlign: 'center',
          }}
        >
          <h1 className={`${titleClassName} font-bold`}>{text}</h1>
        </div>
      )
    }

    // Normal mode
    return (
      <div className="w-full py-8 px-4 text-center flex flex-col items-center justify-center" style={{ fontFamily, color }}>
        <h1 className={`${titleClassName} font-bold text-center mx-auto`}>{text}</h1>
      </div>
    )
  }

  // Settings mode - just show a preview
  const previewSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xlarge: 'text-3xl',
  }
  return (
    <div className="w-full py-4 px-4 text-center border rounded" style={{ fontFamily, color }}>
      <h2 className={`${previewSizeClasses[size]} font-bold`}>{text || 'Event Title'}</h2>
    </div>
  )
}

