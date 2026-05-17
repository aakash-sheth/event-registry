import React from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'
import { cn } from '@/lib/utils'
import { convertToCloudFrontUrl } from '@/lib/image-utils'

interface ImageTileSSRProps {
  settings: ImageTileSettings
  hasTitleOverlay?: boolean
}

/**
 * Server-safe version of ImageTile
 * No client-side hooks, no image dimension detection
 * Renders plain <img> with correct styles based on fitMode
 */
export default function ImageTileSSR({ settings, hasTitleOverlay = false }: ImageTileSSRProps) {
  if (!settings.src) {
    return null
  }

  const blurValue = hasTitleOverlay ? (settings.blur || 0) : 0
  const backgroundColor = settings.backgroundColor || '#ffffff'
  const textOverlays = settings.textOverlays
  const hasTextOverlays = !!(textOverlays && textOverlays.length > 0)

  const renderTextOverlays = () => {
    if (!hasTextOverlays || !textOverlays) return null
    return textOverlays.map((overlay) => {
      const verticalAlign = overlay.verticalAlign ?? 'middle'
      const justifyContent =
        verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'
      const textDecoration = [
        overlay.underline ? 'underline' : '',
        overlay.strikethrough ? 'line-through' : '',
      ]
        .filter(Boolean)
        .join(' ') || 'none'
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

  if (hasTextOverlays) {
    return (
      <div className="w-full flex justify-center">
        <div className="relative w-full max-w-sm overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={convertToCloudFrontUrl(settings.src)}
            alt="Event"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'cover',
              objectPosition: 'center center',
              filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
            }}
          />
          {renderTextOverlays()}
        </div>
      </div>
    )
  }

  // Convert cover position to CSS object-position value
  const getObjectPosition = (): string => {
    const position = settings.coverPosition
    
    // Handle undefined or null - default to center
    if (!position) {
      return 'center center'
    }
    
    // Handle custom object position (x, y percentages)
    if (typeof position === 'object' && position !== null && 'x' in position && 'y' in position) {
      // Custom position: x and y are percentages (0-100)
      return `${position.x}% ${position.y}%`
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
      
      return positionMap[position] || 'center center'
    }
    
    return 'center center'
  }

  const getImageStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
    }

    switch (settings.fitMode) {
      case 'fit-to-screen':
        return { 
          ...baseStyle, 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain' as const
        }

      case 'full-image':
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

  if (settings.fitMode === 'fit-to-screen') {
    return (
      <div
        className="w-full relative overflow-hidden"
        style={{ 
          backgroundColor,
          width: '100%',
          height: '100dvh', // Modern browsers will use this
          maxHeight: '100vh', // Fallback for browsers that don't support dvh
          minHeight: '100vh', // Ensure minimum height
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: 0,
        }}
      >
        <img 
          src={convertToCloudFrontUrl(settings.src)}
          alt="Event"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          style={{
            filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            display: 'block',
          }}
        />
      </div>
    )
  }

  // For full-image (cover) mode
  const imageStyle = getImageStyle()
  const objectPosition = settings.fitMode === 'full-image' 
    ? (imageStyle.objectPosition || getObjectPosition())
    : undefined
  
  return (
    <div
      className={cn(
        "w-full relative overflow-hidden max-h-screen",
        settings.fitMode === 'full-image' ? "min-h-[70vh]" : ""
      )}
      style={{ 
        backgroundColor,
        maxHeight: '100vh',
      }}
    >
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
    </div>
  )
}
