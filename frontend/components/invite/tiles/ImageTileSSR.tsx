import React from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'
import { cn } from '@/lib/utils'

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
          src={settings.src} 
          alt="Event" 
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
