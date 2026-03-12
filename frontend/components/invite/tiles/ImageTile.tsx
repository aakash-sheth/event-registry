'use client'

import React, { useState, useEffect } from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'
import { cn } from '@/lib/utils'

export interface ImageTileProps {
  settings: ImageTileSettings
  preview?: boolean
}

export default function ImageTile({ settings, preview = false }: ImageTileProps) {
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)

  // Load image to get dimensions and aspect ratio
  useEffect(() => {
    if (!settings.src) {
      setImageAspectRatio(null)
      setImageDimensions(null)
      return
    }

    const img = new Image()
    img.onload = () => {
      const aspectRatio = img.width / img.height
      setImageAspectRatio(aspectRatio)
      setImageDimensions({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      setImageAspectRatio(null)
      setImageDimensions(null)
    }
    img.src = settings.src
  }, [settings.src])

  if (!settings.src) {
    if (settings.backgroundGradient) {
      const hasGradientOverlays = settings.textOverlays && settings.textOverlays.length > 0
      const textDecoration = (overlay: NonNullable<ImageTileSettings['textOverlays']>[number]) =>
        [overlay.underline ? 'underline' : '', overlay.strikethrough ? 'line-through' : '']
          .filter(Boolean).join(' ') || 'none'
      return (
        <div
          className="relative w-full overflow-hidden"
          style={{ background: settings.backgroundGradient, aspectRatio: '9 / 16' }}
        >
          {hasGradientOverlays && settings.textOverlays!.map((overlay) => (
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
                textDecoration: textDecoration(overlay),
                textAlign: overlay.textAlign,
                lineHeight: 1.3,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}
            >
              {overlay.text}
            </div>
          ))}
        </div>
      )
    }
    if (preview) return null
    return (
      <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">No image uploaded</p>
      </div>
    )
  }

  const blurValue = settings.blur || 0
  const backgroundColor = settings.backgroundColor || '#ffffff'
  const hasTextOverlays = settings.textOverlays && settings.textOverlays.length > 0

  // Convert cover position to CSS object-position value
  // This is used for 'full-image' (cover) mode
  const getObjectPosition = (): string => {
    const position = settings.coverPosition

    // Handle undefined or null - default to center
    if (!position) {
      return 'center center'
    }

    // Handle custom object position (x, y percentages)
    if (typeof position === 'object' && position !== null && 'x' in position && 'y' in position) {
      // Custom position: x and y are percentages (0-100)
      const result = `${position.x}% ${position.y}%`
      return result
    }

    // Handle string positions
    if (typeof position === 'string') {
      if (position === 'center') {
        return 'center center'
      }

      // Named positions map to CSS object-position values
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

      const result = positionMap[position] || 'center center'
      return result
    }

    return 'center center'
  }

  const getImageStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
    }

    switch (settings.fitMode) {
      case 'fit-to-screen':
        // For fit-to-screen, use object-fit: contain with constrained dimensions
        return {
          ...baseStyle,
          width: '100%',
          height: '100%',
          objectFit: 'contain' as const
        }

      case 'full-image':
        // Cover mode: fill container with position control
        return {
          ...baseStyle,
          width: '100%',
          height: '100%',
          objectFit: 'cover' as const,
          objectPosition: getObjectPosition()
        }

      default:
        return { ...baseStyle, width: '100%', height: 'auto', objectFit: 'cover' as const }
    }
  }

  const shape = settings.shape || 'rectangle'
  const frameStyle = settings.frameStyle ?? 'none'
  const frameColor = settings.frameColor || '#D4AF37'
  const frameWidth = Math.min(8, Math.max(1, settings.frameWidth ?? 2))

  const getShapeWrapperStyle = (): React.CSSProperties => {
    if (shape === 'circle') {
      return {
        width: '100%',
        maxWidth: 'min(100%, 85vh)',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        borderRadius: '50%',
        overflow: 'hidden' as const,
      }
    }
    if (shape === 'rounded') {
      return { borderRadius: 24, overflow: 'hidden' as const }
    }
    return {}
  }

  const renderFrameWrapper = (content: React.ReactNode) => {
    if (frameStyle === 'none') return content
    if (frameStyle === 'double') {
      return (
        <div
          style={{
            padding: frameWidth,
            background: frameColor,
            borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? 24 + frameWidth : 0,
            display: 'inline-block',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              padding: frameWidth,
              background: backgroundColor,
              borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? 24 : 0,
              overflow: 'hidden',
            }}
          >
            {content}
          </div>
        </div>
      )
    }
    return (
      <div
        style={{
          border: `${frameWidth}px solid ${frameColor}`,
          borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? 24 : 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {content}
      </div>
    )
  }

  // Render text overlays from card designer (positioned within a 9:16 container)
  const renderTextOverlays = () => {
    if (!hasTextOverlays) return null
    return settings.textOverlays!.map((overlay) => {
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
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          {overlay.text}
        </div>
      )
    })
  }

  if (preview) {
    if (settings.fitMode === 'fit-to-screen') {
      // Fit-to-screen mode logic based on image aspect ratio
      // Landscape or Square (aspectRatio >= 1.0): Fill width, container 100vh, background top/bottom
      // Portrait (aspectRatio < 1.0): Fill width, container 100vh, scale down if needed, background left/right
      // Uses adaptive viewport height: 100dvh for modern mobile browsers, 100vh fallback for others
      const imgEl = (
        <img
          src={settings.src}
          alt="Event"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          style={{
            filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
            width: '100%',
            height: '100%',
            maxWidth: shape === 'circle' || shape === 'rounded' ? '100%' : '100%',
            maxHeight: shape === 'circle' || shape === 'rounded' ? '100%' : '100%',
            objectFit: shape === 'circle' || shape === 'rounded' ? 'cover' : 'contain',
            objectPosition: 'center center',
            display: 'block',
          }}
        />
      )
      const shapeWrapped = shape !== 'rectangle' ? (
        <div style={getShapeWrapperStyle()}>{imgEl}</div>
      ) : (
        imgEl
      )
      return (
        <div
          className="w-full relative overflow-hidden"
          style={{
            backgroundColor,
            width: '100%',
            height: '100dvh',
            maxHeight: '100vh',
            minHeight: '100vh',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0,
            padding: 0,
          }}
        >
          {frameStyle !== 'none' ? renderFrameWrapper(shapeWrapped) : shapeWrapped}
        </div>
      )
    }

    // When textOverlays are present, use a 9:16 container to match the card designer canvas
    // so overlay coordinates are pixel-perfect between the designer and the invite page.
    if (hasTextOverlays) {
      return (
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: '9 / 16' }}
        >
          <img
            src={settings.src}
            alt="Event"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'cover',
              objectPosition: getObjectPosition(),
              filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
            }}
          />
          {renderTextOverlays()}
        </div>
      )
    }

    // For full-image (cover) mode, ensure position is applied
    const imageStyle = getImageStyle()
    const objectPosition = settings.fitMode === 'full-image'
      ? (imageStyle.objectPosition || getObjectPosition())
      : undefined

    const coverImgEl = (
      <img
        src={settings.src}
        alt="Event"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        style={{
          ...imageStyle,
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          objectPosition: objectPosition,
        }}
      />
    )
    const coverShapeWrapped = shape !== 'rectangle' ? (
      <div style={{ ...getShapeWrapperStyle(), width: '100%', height: '100%', minHeight: '70vh' }}>{coverImgEl}</div>
    ) : (
      coverImgEl
    )
    return (
      <div
        className={cn(
          'w-full relative overflow-hidden max-h-screen',
          settings.fitMode === 'full-image' ? 'min-h-[70vh]' : ''
        )}
        style={{
          backgroundColor,
          maxHeight: '100vh',
          display: shape !== 'rectangle' ? 'flex' : undefined,
          alignItems: shape !== 'rectangle' ? 'center' : undefined,
          justifyContent: shape !== 'rectangle' ? 'center' : undefined,
        }}
      >
        {frameStyle !== 'none' ? renderFrameWrapper(coverShapeWrapped) : coverShapeWrapped}
      </div>
    )
  }

  const editorImg = (
    <img
      src={settings.src}
      alt="Preview"
      className={cn(
        'w-full object-cover',
        shape === 'circle' ? 'h-full aspect-square' : 'h-48'
      )}
      loading="lazy"
      style={shape === 'rounded' ? { borderRadius: 24 } : undefined}
    />
  )
  const editorShapeWrapped = shape !== 'rectangle' ? (
    <div
      className={cn(
        'w-full flex justify-center',
        shape === 'circle' && 'aspect-square max-h-48'
      )}
      style={shape === 'circle' ? { borderRadius: '50%', overflow: 'hidden' } : shape === 'rounded' ? { borderRadius: 24, overflow: 'hidden' } : undefined}
    >
      {editorImg}
    </div>
  ) : (
    editorImg
  )
  return (
    <div className="w-full border rounded-lg overflow-hidden" style={{ backgroundColor }}>
      {frameStyle !== 'none' ? renderFrameWrapper(editorShapeWrapped) : editorShapeWrapped}
    </div>
  )
}
