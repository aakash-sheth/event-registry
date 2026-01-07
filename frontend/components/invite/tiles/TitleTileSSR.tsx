import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

interface TitleTileSSRProps {
  settings: TitleTileSettings
  overlayMode?: boolean
}

/**
 * Server-safe version of TitleTile
 * Supports both overlay mode (absolute positioning) and standalone mode
 * No client-side hooks or interactions
 */
export default function TitleTileSSR({ settings, overlayMode = false }: TitleTileSSRProps) {
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

  // Overlay mode - position within image (matches client TitleTile overlay mode)
  if (overlayMode) {
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

  // Standalone mode - normal flow layout
  return (
    <div className="w-full py-8 px-4 text-center flex flex-col items-center justify-center" style={{ fontFamily, color }}>
      <h1 className={`${titleClassName} font-bold text-center mx-auto`}>{text}</h1>
    </div>
  )
}
