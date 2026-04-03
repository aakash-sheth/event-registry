import React from 'react'
import { GreetingCardTileSettings } from '@/lib/invite/schema'

interface GreetingCardTileSSRProps {
  settings: GreetingCardTileSettings
  hasTitleOverlay?: boolean
}

/**
 * Server-safe version of GreetingCardTile.
 * No client-side hooks. Renders a 9:16 card with image or gradient background
 * and static text overlays using absolute positioning.
 */
export default function GreetingCardTileSSR({ settings }: GreetingCardTileSSRProps) {
  const hasImage = !!settings.src
  const hasGradient = !!settings.backgroundGradient

  if (!hasImage && !hasGradient) {
    return null
  }

  const renderTextOverlays = () => {
    if (!settings.textOverlays || settings.textOverlays.length === 0) return null
    return settings.textOverlays.map((overlay) => {
      const verticalAlign = overlay.verticalAlign ?? 'middle'
      const justifyContent =
        verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'
      const textDecoration = [
        overlay.underline ? 'underline' : '',
        overlay.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ') || 'none'
      return (
        <div
          key={overlay.id}
          style={{
            position: 'absolute',
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            width: `${overlay.width}%`,
            fontFamily: overlay.fontFamily,
            fontSize: `${overlay.fontSize}px`,
            color: overlay.color,
            fontWeight: overlay.bold ? 700 : 400,
            fontStyle: overlay.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: overlay.textAlign,
            lineHeight: 1.3,
            display: 'flex',
            flexDirection: 'column',
            justifyContent,
            ...(overlay.height != null
              ? { height: `${overlay.height}%`, overflow: 'hidden' }
              : { minHeight: `${overlay.fontSize * 1.6}px` }),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            padding: '2px 4px',
            pointerEvents: 'none',
          }}
        >
          {overlay.text}
        </div>
      )
    })
  }

  if (!hasImage && hasGradient) {
    return (
      <div className="w-full flex justify-center">
        <div
          className="relative w-full max-w-sm overflow-hidden"
          style={{ background: settings.backgroundGradient, aspectRatio: '9 / 16' }}
        >
          {renderTextOverlays()}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-center">
      <div
        className="relative w-full max-w-sm overflow-hidden"
        style={{ aspectRatio: '9 / 16' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={settings.src}
          alt="Greeting card"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', objectPosition: 'center center' }}
        />
        {renderTextOverlays()}
      </div>
    </div>
  )
}
