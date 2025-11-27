'use client'

import React from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'
import { cn } from '@/lib/utils'

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

  // Convert cover position to CSS object-position value
  // This is used for 'full-image' (cover) mode
  const getObjectPosition = (): string => {
    const position = settings.coverPosition
    
    // Debug logging to help diagnose position issues
    if (settings.fitMode === 'full-image') {
      console.log('[ImageTile] coverPosition:', position, 'fitMode:', settings.fitMode, 'Settings:', settings)
    }
    
    // Handle undefined or null - default to center
    if (!position) {
      if (settings.fitMode === 'full-image') {
        console.warn('[ImageTile] No coverPosition found for full-image mode, defaulting to center center')
      }
      return 'center center'
    }
    
    // Handle custom object position (x, y percentages)
    if (typeof position === 'object' && position !== null && 'x' in position && 'y' in position) {
      // Custom position: x and y are percentages (0-100)
      const result = `${position.x}% ${position.y}%`
      console.log('[ImageTile] Using custom position:', result, 'from:', position)
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
      console.log('[ImageTile] Using named position:', position, '->', result)
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

  if (preview) {
    if (settings.fitMode === 'fit-to-screen') {
      // For fit-to-screen, make container fill viewport and center the image
      return (
        <div
          className="w-full relative overflow-hidden flex items-center justify-center max-h-screen"
          style={{ 
            backgroundColor,
            minHeight: '100vh',
            maxHeight: '100vh',
            height: '100vh',
          }}
        >
          <img 
            src={settings.src} 
            alt="Event" 
            style={{
              ...getImageStyle(),
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
        </div>
      )
    }

    // For full-image (cover) mode, ensure position is applied
    const imageStyle = getImageStyle()
    const objectPosition = settings.fitMode === 'full-image' 
      ? (imageStyle.objectPosition || getObjectPosition())
      : undefined
    
    // Debug logging
    if (settings.fitMode === 'full-image') {
      console.log('[ImageTile Preview] Final objectPosition:', objectPosition, 'Settings:', {
        fitMode: settings.fitMode,
        coverPosition: settings.coverPosition,
        imageStyleObjectPosition: imageStyle.objectPosition,
        fullSettings: settings
      })
    }
    
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
            // Explicitly set objectPosition for cover mode
            objectPosition: objectPosition,
          }} 
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

