import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

interface TitleTileSSRProps {
  settings: TitleTileSettings
}

/**
 * Server-safe version of TitleTile for overlay mode
 * Renders title text with positioning based on overlayPosition
 * No client-side hooks or interactions
 */
export default function TitleTileSSR({ settings }: TitleTileSSRProps) {
  const fontFamily = settings.font || FONT_OPTIONS[0].family
  const color = settings.color || '#000000'
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'

  // Size classes mapping (matches client version)
  const sizeClasses = {
    small: 'text-xl md:text-2xl',
    medium: 'text-3xl md:text-4xl',
    large: 'text-4xl md:text-5xl',
    xlarge: 'text-5xl md:text-6xl',
  }

  const titleClassName = sizeClasses[size]
  const position = settings.overlayPosition || { x: 50, y: 50 }

  // Overlay mode - position within image (matches client TitleTile overlay mode)
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
