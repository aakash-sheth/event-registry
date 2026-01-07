'use client'

import React, { useState, useEffect } from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'
import { cn } from '@/lib/utils'

export interface ImageTileProps {
  settings: ImageTileSettings
  preview?: boolean
  hasTitleOverlay?: boolean
}

export default function ImageTile({ settings, preview = false, hasTitleOverlay = false }: ImageTileProps) {
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

  if (preview) {
    if (settings.fitMode === 'fit-to-screen') {
      // Fit-to-screen mode logic based on image aspect ratio
      // Landscape or Square (aspectRatio >= 1.0): Fill width, container 100vh, background top/bottom
      // Portrait (aspectRatio < 1.0): Fill width, container 100vh, scale down if needed, background left/right
      // Uses adaptive viewport height: 100dvh for modern mobile browsers, 100vh fallback for others
      
      return (
        <div
          className="w-full relative overflow-hidden"
          style={{ 
            backgroundColor,
            width: '100%',
            // Adaptive: 100dvh for modern mobile browsers (dynamic), 100vh fallback for older browsers
            height: '100dvh', // Modern browsers will use this
            maxHeight: '100vh', // Fallback for browsers that don't support dvh
            minHeight: '100vh', // Ensure minimum height
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0, // Explicitly remove margins to prevent overflow
            padding: 0, // Explicitly remove padding to prevent overflow
          }}
        >
          <img 
            src={settings.src} 
            alt="Event" 
            style={{
              filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
              width: '100%',
              height: '100%',
              maxWidth: '100%', // Ensure image doesn't exceed container width
              maxHeight: '100%', // Ensure image doesn't exceed container height
              objectFit: 'contain',
              objectPosition: 'center center',
              display: 'block',
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
          loading="lazy"
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
        loading="lazy"
      />
    </div>
  )
}

