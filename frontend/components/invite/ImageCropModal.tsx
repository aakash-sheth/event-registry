'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ZoomIn, ZoomOut } from 'lucide-react'
import DevicePreview from './DevicePreview'

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface ImageCropModalProps {
  imageSrc: string
  imageDimensions: { width: number; height: number; aspectRatio: number }
  recommendedAspectRatio: number // 0.75 for 3:4 or 0.5625 for 9:16
  onCrop: (croppedImageSrc: string, focusPoint?: { x: number; y: number }) => void
  onCancel: () => void
}

const ASPECT_RATIOS = [
  { label: '3:4 (Portrait - Recommended)', value: 0.75, description: 'Best for mobile, works on all devices' },
  { label: '9:16 (Story/Mobile)', value: 0.5625, description: 'Perfect for mobile, vertical displays' },
  { label: '4:5 (Instagram-friendly)', value: 0.8, description: 'Great for social sharing' },
  { label: '1:1 (Square)', value: 1.0, description: 'Versatile, works everywhere' },
  { label: '4:3 (Landscape)', value: 1.333, description: 'Desktop-friendly' },
  { label: '16:9 (Widescreen)', value: 1.778, description: 'Best for desktop' },
]

export default function ImageCropModal({
  imageSrc,
  imageDimensions,
  recommendedAspectRatio,
  onCrop,
  onCancel,
}: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [cropArea, setCropArea] = useState<CropArea | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(1)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<number>(recommendedAspectRatio || 0.75)
  const [zoom, setZoom] = useState(1.0) // 0.5 to 3.0
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const [showSafeZone, setShowSafeZone] = useState(true)

  // Calculate initial crop area
  useEffect(() => {
    const calculateCropArea = () => {
      if (!containerRef.current) return false

      const container = containerRef.current
      // Use getBoundingClientRect for more accurate measurements
      const rect = container.getBoundingClientRect()
      const containerWidth = rect.width || container.clientWidth
      const containerHeight = rect.height || container.clientHeight

      // Wait for container to have valid dimensions
      if (containerWidth === 0 || containerHeight === 0 || !isFinite(containerWidth) || !isFinite(containerHeight)) {
        return false
      }

      setContainerSize({ width: containerWidth, height: containerHeight })

      // Calculate crop dimensions based on selected aspect ratio
      let cropWidth: number
      let cropHeight: number

      // Use 80% of container for crop area
      const maxCropWidth = containerWidth * 0.8
      const maxCropHeight = containerHeight * 0.8

      if (maxCropWidth / maxCropHeight > selectedAspectRatio) {
        // Container is wider than needed, fit to height
        cropHeight = maxCropHeight
        cropWidth = cropHeight * selectedAspectRatio
      } else {
        // Container is taller than needed, fit to width
        cropWidth = maxCropWidth
        cropHeight = cropWidth / selectedAspectRatio
      }

      // Calculate scale to fit image in container
      const imageAspectRatio = imageDimensions.width / imageDimensions.height
      const containerAspectRatio = containerWidth / containerHeight

      let baseScale: number
      if (imageAspectRatio > containerAspectRatio) {
        // Image is wider, fit to width
        baseScale = containerWidth / imageDimensions.width
      } else {
        // Image is taller, fit to height
        baseScale = containerHeight / imageDimensions.height
      }
      
      // Ensure scale is valid
      if (!isFinite(baseScale) || baseScale <= 0) {
        baseScale = 1
      }
      
      // Apply zoom to scale
      setImageScale(baseScale * zoom)

      // Calculate crop area in image coordinates
      const finalScale = baseScale * zoom
      const scaledImageWidth = imageDimensions.width * finalScale
      const scaledImageHeight = imageDimensions.height * finalScale
      
      // Center the crop area (or use focus point if set)
      let cropX: number
      let cropY: number
      
      if (focusPoint) {
        // Position crop area to center on focus point
        const focusX = (focusPoint.x / 100) * imageDimensions.width
        const focusY = (focusPoint.y / 100) * imageDimensions.height
        cropX = focusX - (cropWidth / finalScale) / 2
        cropY = focusY - (cropHeight / finalScale) / 2
      } else {
        cropX = (scaledImageWidth - cropWidth) / 2
        cropY = (scaledImageHeight - cropHeight) / 2
      }

      // Convert back to image coordinates and ensure valid values
      const cropAreaX = Math.max(0, cropX / finalScale)
      const cropAreaY = Math.max(0, cropY / finalScale)
      const cropAreaWidth = Math.min(imageDimensions.width, cropWidth / finalScale)
      const cropAreaHeight = Math.min(imageDimensions.height, cropHeight / finalScale)

      // Ensure crop area doesn't exceed image bounds
      const finalX = Math.min(cropAreaX, imageDimensions.width - cropAreaWidth)
      const finalY = Math.min(cropAreaY, imageDimensions.height - cropAreaHeight)

      setCropArea({
        x: Math.max(0, finalX),
        y: Math.max(0, finalY),
        width: cropAreaWidth,
        height: cropAreaHeight,
      })
      
      return true
    }

    // Try to calculate immediately
    let retryCount = 0
    const maxRetries = 10
    
    const tryCalculate = () => {
      if (calculateCropArea()) {
        return // Success!
      }
      
      retryCount++
      if (retryCount < maxRetries) {
        // Retry after a short delay
        retryTimeoutRef.current = setTimeout(tryCalculate, 50)
      } else {
        // Fallback: use image dimensions directly
        const cropWidth = Math.min(imageDimensions.width * 0.8, imageDimensions.width)
        const cropHeight = Math.min(cropWidth / selectedAspectRatio, imageDimensions.height)
        const finalCropWidth = Math.min(cropWidth, imageDimensions.width)
        const finalCropHeight = Math.min(cropHeight, imageDimensions.height)
        
        setCropArea({
          x: Math.max(0, (imageDimensions.width - finalCropWidth) / 2),
          y: Math.max(0, (imageDimensions.height - finalCropHeight) / 2),
          width: finalCropWidth,
          height: finalCropHeight,
        })
        setImageScale(1 * zoom)
        setContainerSize({ width: 800, height: 600 }) // Fallback size
      }
    }
    
    // Start trying
    tryCalculate()
    
    // Also set up ResizeObserver for dynamic resizing
    let resizeObserver: ResizeObserver | null = null
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        calculateCropArea()
      })
      resizeObserver.observe(containerRef.current)
    }
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [imageDimensions, selectedAspectRatio, zoom, focusPoint])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!cropArea || !containerRef.current) return
    e.preventDefault()
    setIsDragging(true)
    const rect = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    const scrollTop = containerRef.current.scrollTop
    const containerWidth = containerSize.width || 800
    const containerHeight = containerSize.height || 600
    const imageDisplaySize = {
      width: imageDimensions.width * imageScale,
      height: imageDimensions.height * imageScale,
    }
    const imageRect = {
      left: rect.left + scrollLeft + Math.max(0, (containerWidth - imageDisplaySize.width) / 2),
      top: rect.top + scrollTop + Math.max(0, (containerHeight - imageDisplaySize.height) / 2),
    }
    setDragStart({
      x: e.clientX - imageRect.left - cropArea.x * imageScale,
      y: e.clientY - imageRect.top - cropArea.y * imageScale,
    })
  }, [cropArea, imageScale, imageDimensions, containerSize])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !cropArea || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    const scrollTop = containerRef.current.scrollTop
    const containerWidth = containerSize.width || 800
    const containerHeight = containerSize.height || 600
    const imageDisplaySize = {
      width: imageDimensions.width * imageScale,
      height: imageDimensions.height * imageScale,
    }
    const imageRect = {
      left: rect.left + scrollLeft + Math.max(0, (containerWidth - imageDisplaySize.width) / 2),
      top: rect.top + scrollTop + Math.max(0, (containerHeight - imageDisplaySize.height) / 2),
    }
    
    const x = (e.clientX - imageRect.left - dragStart.x) / imageScale
    const y = (e.clientY - imageRect.top - dragStart.y) / imageScale

    // Constrain crop area within image bounds
    const maxX = imageDimensions.width - cropArea.width
    const maxY = imageDimensions.height - cropArea.height

    setCropArea({
      ...cropArea,
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    })
  }, [isDragging, cropArea, dragStart, imageScale, imageDimensions, containerSize])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Global mouse events
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!cropArea || !containerRef.current) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const scrollLeft = containerRef.current.scrollLeft
        const scrollTop = containerRef.current.scrollTop
        const containerWidth = containerSize.width || 800
        const containerHeight = containerSize.height || 600
        const imageDisplaySize = {
          width: imageDimensions.width * imageScale,
          height: imageDimensions.height * imageScale,
        }
        const imageRect = {
          left: rect.left + scrollLeft + Math.max(0, (containerWidth - imageDisplaySize.width) / 2),
          top: rect.top + scrollTop + Math.max(0, (containerHeight - imageDisplaySize.height) / 2),
        }
        
        const x = (e.clientX - imageRect.left - dragStart.x) / imageScale
        const y = (e.clientY - imageRect.top - dragStart.y) / imageScale

        const maxX = imageDimensions.width - cropArea.width
        const maxY = imageDimensions.height - cropArea.height

        setCropArea({
          ...cropArea,
          x: Math.max(0, Math.min(maxX, x)),
          y: Math.max(0, Math.min(maxY, y)),
        })
      }

      const handleGlobalMouseUp = () => {
        setIsDragging(false)
      }

      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove)
        window.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }
  }, [isDragging, cropArea, dragStart, imageScale, imageDimensions])

  // Calculate safe zone (visible on all devices)
  const calculateSafeZone = (): CropArea | null => {
    if (!cropArea) return null
    
    // Safe zone is the intersection of:
    // - Mobile (9:16 = 0.5625): shows center width, full height
    // - Desktop (16:9 = 1.778): shows full width, center height
    const mobileAspect = 0.5625
    const desktopAspect = 1.778
    const cropAspect = cropArea.width / cropArea.height
    
    let safeWidth: number
    let safeHeight: number
    
    if (cropAspect > mobileAspect) {
      // Crop is wider than mobile - safe zone limited by mobile
      safeHeight = cropArea.height
      safeWidth = safeHeight * mobileAspect
    } else {
      safeWidth = cropArea.width
      safeHeight = safeWidth / desktopAspect
    }
    
    return {
      x: cropArea.x + (cropArea.width - safeWidth) / 2,
      y: cropArea.y + (cropArea.height - safeHeight) / 2,
      width: safeWidth,
      height: safeHeight,
    }
  }

  const handleCrop = async () => {
    if (!cropArea) return

    const { cropImage } = await import('@/lib/invite/imageAnalysis')
    try {
      const croppedImage = await cropImage(imageSrc, cropArea)
      // Focus point is already relative to crop area (0-100% within crop frame)
      // This is perfect for object-position on the cropped image
      const relativeFocusPoint = focusPoint || { x: 50, y: 50 } // Default to center if not set
      onCrop(croppedImage, relativeFocusPoint)
    } catch (error) {
      console.error('Error cropping image:', error)
      onCrop(imageSrc) // Fallback to original
    }
  }

  if (!cropArea) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl bg-white">
          <CardContent className="p-6">
            <p className="text-center">Loading crop tool...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayCropArea = {
    x: cropArea.x * imageScale,
    y: cropArea.y * imageScale,
    width: cropArea.width * imageScale,
    height: cropArea.height * imageScale,
  }

  const imageDisplaySize = {
    width: imageDimensions.width * imageScale,
    height: imageDimensions.height * imageScale,
  }

  // Calculate image position within the container
  // The image is centered, so offset is relative to the container center
  const containerWidth = containerSize.width || 800
  const containerHeight = containerSize.height || 600
  const imageOffset = {
    x: Math.max(0, (containerWidth - imageDisplaySize.width) / 2),
    y: Math.max(0, (containerHeight - imageDisplaySize.height) / 2),
  }
  
  // Calculate crop frame position relative to image (not container)
  const cropFramePosition = {
    x: displayCropArea.x,
    y: displayCropArea.y,
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-white flex flex-col">
        <CardHeader className="overflow-y-auto max-h-[40vh]">
          <CardTitle className="text-eco-green">Crop Image for All Devices</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Select aspect ratio, adjust zoom, and preview how it looks on different devices
          </p>
          
          {/* Aspect Ratio Selector */}
          <div className="mt-4">
            <label className="block text-xs font-medium mb-2">Aspect Ratio</label>
            <select
              value={selectedAspectRatio}
              onChange={(e) => {
                const newRatio = parseFloat(e.target.value)
                setSelectedAspectRatio(newRatio)
              }}
              className="w-full text-sm border rounded px-2 py-1"
            >
              {ASPECT_RATIOS.map(ratio => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {ASPECT_RATIOS.find(r => r.value === selectedAspectRatio)?.description}
            </p>
          </div>

          {/* Zoom Controls */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">Zoom</label>
              <span className="text-xs text-gray-600">{zoom.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))}
                disabled={zoom >= 3.0}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5x</span>
              <span>3.0x</span>
            </div>
          </div>

          {/* Focus Point Toggle */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="focusPoint"
              checked={!!focusPoint}
              onChange={(e) => {
                if (e.target.checked) {
                  setFocusPoint({ x: 50, y: 50 }) // Default center
                } else {
                  setFocusPoint(null)
                }
              }}
              className="form-checkbox"
            />
            <label htmlFor="focusPoint" className="text-xs">
              Set focus point (mark important area)
            </label>
          </div>

          {/* Safe Zone Toggle */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="safeZone"
              checked={showSafeZone}
              onChange={(e) => setShowSafeZone(e.target.checked)}
              className="form-checkbox"
            />
            <label htmlFor="safeZone" className="text-xs">
              Show safe zone (visible on all devices)
            </label>
          </div>

          {/* Device Previews */}
          {cropArea && (
            <div className="mt-4">
              <label className="block text-xs font-medium mb-2">Device Preview</label>
              <DevicePreview
                imageSrc={imageSrc}
                cropArea={cropArea}
                imageDimensions={imageDimensions}
                aspectRatio={selectedAspectRatio}
                zoom={zoom}
                focusPoint={focusPoint || undefined}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg flex-1 overflow-auto"
            style={{
              minHeight: '400px',
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Full image - ensure it's fully visible */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width: `${Math.max(imageDisplaySize.width, containerSize.width || 800)}px`,
                height: `${Math.max(imageDisplaySize.height, containerSize.height || 600)}px`,
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <img
                src={imageSrc}
                alt="Crop preview"
                className="block"
                style={{
                  width: `${imageDisplaySize.width}px`,
                  height: `${imageDisplaySize.height}px`,
                  objectFit: 'contain',
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
                draggable={false}
              />

              {/* Overlay - darken areas outside crop (positioned relative to image) */}
              <div
                className="absolute"
                style={{
                  left: `${imageOffset.x}px`,
                  top: `${imageOffset.y}px`,
                  width: `${imageDisplaySize.width}px`,
                  height: `${imageDisplaySize.height}px`,
                  background: `
                    linear-gradient(to right, 
                      rgba(0,0,0,0.6) 0%, 
                      rgba(0,0,0,0.6) ${(cropFramePosition.x / imageDisplaySize.width) * 100}%,
                      transparent ${(cropFramePosition.x / imageDisplaySize.width) * 100}%,
                      transparent ${((cropFramePosition.x + displayCropArea.width) / imageDisplaySize.width) * 100}%,
                      rgba(0,0,0,0.6) ${((cropFramePosition.x + displayCropArea.width) / imageDisplaySize.width) * 100}%,
                      rgba(0,0,0,0.6) 100%
                    ),
                    linear-gradient(to bottom, 
                      rgba(0,0,0,0.6) 0%, 
                      rgba(0,0,0,0.6) ${(cropFramePosition.y / imageDisplaySize.height) * 100}%,
                      transparent ${(cropFramePosition.y / imageDisplaySize.height) * 100}%,
                      transparent ${((cropFramePosition.y + displayCropArea.height) / imageDisplaySize.height) * 100}%,
                      rgba(0,0,0,0.6) ${((cropFramePosition.y + displayCropArea.height) / imageDisplaySize.height) * 100}%,
                      rgba(0,0,0,0.6) 100%
                    )
                  `,
                }}
              />

              {/* Safe Zone Overlay */}
              {showSafeZone && cropArea && (() => {
                const safeZone = calculateSafeZone()
                if (!safeZone) return null
                const safeZoneDisplay = {
                  x: (safeZone.x - cropArea.x) * imageScale,
                  y: (safeZone.y - cropArea.y) * imageScale,
                  width: safeZone.width * imageScale,
                  height: safeZone.height * imageScale,
                }
                return (
                  <div
                    className="absolute border-2 border-yellow-400 border-dashed pointer-events-none z-20"
                    style={{
                      left: `${imageOffset.x + displayCropArea.x + safeZoneDisplay.x}px`,
                      top: `${imageOffset.y + displayCropArea.y + safeZoneDisplay.y}px`,
                      width: `${safeZoneDisplay.width}px`,
                      height: `${safeZoneDisplay.height}px`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 text-xs text-yellow-600 bg-yellow-100 px-1 rounded whitespace-nowrap">
                      Safe Zone
                    </div>
                  </div>
                )
              })()}

              {/* Focus Point Indicator */}
              {focusPoint && cropArea && (
                <div
                  className="absolute w-3 h-3 border-2 border-red-500 bg-red-500 rounded-full pointer-events-none z-30"
                  style={{
                    left: `${imageOffset.x + displayCropArea.x + (focusPoint.x / 100 * displayCropArea.width) - 6}px`,
                    top: `${imageOffset.y + displayCropArea.y + (focusPoint.y / 100 * displayCropArea.height) - 6}px`,
                  }}
                />
              )}

              {/* Focus Point Picker - click on image to set */}
              {focusPoint !== null && (
                <div
                  className="absolute inset-0 cursor-crosshair z-10"
                  onClick={(e) => {
                    if (!cropArea || !containerRef.current) return
                    const rect = containerRef.current.getBoundingClientRect()
                    const scrollLeft = containerRef.current.scrollLeft
                    const scrollTop = containerRef.current.scrollTop
                    const containerWidth = containerSize.width || 800
                    const containerHeight = containerSize.height || 600
                    const imageDisplaySize = {
                      width: imageDimensions.width * imageScale,
                      height: imageDimensions.height * imageScale,
                    }
                    const imageRect = {
                      left: rect.left + scrollLeft + Math.max(0, (containerWidth - imageDisplaySize.width) / 2),
                      top: rect.top + scrollTop + Math.max(0, (containerHeight - imageDisplaySize.height) / 2),
                    }
                    const x = ((e.clientX - imageRect.left - imageOffset.x - displayCropArea.x) / displayCropArea.width) * 100
                    const y = ((e.clientY - imageRect.top - imageOffset.y - displayCropArea.y) / displayCropArea.height) * 100
                    setFocusPoint({
                      x: Math.max(0, Math.min(100, x)),
                      y: Math.max(0, Math.min(100, y)),
                    })
                  }}
                />
              )}

              {/* Crop frame (positioned relative to image) */}
              <div
                className="absolute border-2 border-white shadow-lg cursor-move z-10"
                style={{
                  left: `${imageOffset.x + cropFramePosition.x}px`,
                  top: `${imageOffset.y + cropFramePosition.y}px`,
                  width: `${displayCropArea.width}px`,
                  height: `${displayCropArea.height}px`,
                }}
                onMouseDown={handleMouseDown}
              >
                {/* Corner handles */}
                <div className="absolute -top-1 -left-1 w-4 h-4 bg-white border-2 border-eco-green rounded-full" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-white border-2 border-eco-green rounded-full" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-white border-2 border-eco-green rounded-full" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border-2 border-eco-green rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4 justify-end">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="bg-eco-green hover:bg-green-600" onClick={handleCrop}>
              Apply Crop
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

