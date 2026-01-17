'use client'

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { logError, logDebug } from '@/lib/error-handler'

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
  allowedAspectRatios?: number[] // Optional: restrict ratio options (e.g., [1200/630] for link previews)
  existingCropData?: CropArea // Existing crop data if available
  existingAspectRatio?: number // Existing aspect ratio if available
  onCrop: (
    originalImageSrc: string,
    metadata: {
      cropData: CropArea
      aspectRatio: number
    }
  ) => void
  onCancel: () => void
  onClose?: () => void // Optional close handler for after successful save
}

const LINK_PREVIEW_ASPECT_RATIO = 1200 / 630 // 1.91:1 (Open Graph standard)

const ASPECT_RATIOS = [
  { label: 'Link Preview (1.91:1)', value: LINK_PREVIEW_ASPECT_RATIO, description: 'Recommended for WhatsApp/Twitter/Facebook link previews' },
  { label: 'Portrait (3:4)', value: 0.75, description: 'Recommended - works well on all devices' },
  { label: 'Square (1:1)', value: 1.0, description: 'Versatile format' },
  { label: 'Landscape (4:3)', value: 1.333, description: 'Wider format' },
]

export default function ImageCropModal({
  imageSrc,
  imageDimensions,
  recommendedAspectRatio,
  allowedAspectRatios,
  existingCropData,
  existingAspectRatio,
  onCrop,
  onCancel,
  onClose,
}: ImageCropModalProps) {
  const { showToast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false) // Track if we've initialized with existing data
  const [originalImageSrc] = useState(imageSrc) // Store original for reset
  const [cropArea, setCropArea] = useState<CropArea | null>(existingCropData || null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(0.1) // Start with a small scale to ensure image is visible
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 }) // Position of image (for panning)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<number>(existingAspectRatio || recommendedAspectRatio || 0.75)
  const [zoom, setZoom] = useState(1.0) // 0.5 to 3.0
  const [showSafeZone, setShowSafeZone] = useState(true)
  const [isSaved, setIsSaved] = useState(false) // Track if crop has been saved
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false) // Track if there are unsaved changes after initial save
  const [savedCropArea, setSavedCropArea] = useState<CropArea | null>(null) // Track what was last saved
  const [savedAspectRatio, setSavedAspectRatio] = useState<number | null>(null) // Track what aspect ratio was last saved

  const availableAspectRatios = useMemo(() => {
    if (!allowedAspectRatios || allowedAspectRatios.length === 0) return ASPECT_RATIOS
    const allowed = new Set(allowedAspectRatios.map(r => Number(r)))
    const filtered = ASPECT_RATIOS.filter(r => allowed.has(Number(r.value)))
    // Ensure the recommended ratio is available even if not explicitly included.
    if (recommendedAspectRatio && !filtered.some(r => Number(r.value) === Number(recommendedAspectRatio))) {
      filtered.unshift({
        label: `Recommended (${recommendedAspectRatio.toFixed(2)}:1)`,
        value: recommendedAspectRatio,
        description: 'Recommended aspect ratio',
      })
    }
    return filtered.length > 0 ? filtered : ASPECT_RATIOS
  }, [allowedAspectRatios, recommendedAspectRatio])

  const selectedAspectRatioDescription = useMemo(() => {
    const match = availableAspectRatios.find(r => Number(r.value) === Number(selectedAspectRatio))
    return match?.description
  }, [availableAspectRatios, selectedAspectRatio])

  // Calculate initial setup - Instagram style: fixed crop frame, image moves behind it
  useEffect(() => {
    const calculateSetup = () => {
      if (!containerRef.current) return false

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const containerWidth = rect.width || container.clientWidth
      const containerHeight = rect.height || container.clientHeight

      if (containerWidth === 0 || containerHeight === 0 || !isFinite(containerWidth) || !isFinite(containerHeight)) {
        return false
      }

      setContainerSize({ width: containerWidth, height: containerHeight })

      // Calculate crop frame size based on aspect ratio (fixed in center)
      // Use responsive padding: smaller on mobile
      const padding = containerWidth < 640 ? 20 : 40
      const availableWidth = Math.max(0, containerWidth - padding * 2)
      const availableHeight = Math.max(0, containerHeight - padding * 2)
      
      const frameAspectRatio = selectedAspectRatio
      let frameWidth: number
      let frameHeight: number
      
      if (availableWidth / availableHeight > frameAspectRatio) {
        // Container is wider than needed, fit to height
        frameHeight = availableHeight
        frameWidth = frameHeight * frameAspectRatio
      } else {
        // Container is taller than needed, fit to width
        frameWidth = availableWidth
        frameHeight = frameWidth / frameAspectRatio
      }
      
      // Calculate base scale to fit image in crop frame
      // The image should be slightly larger than the frame so we can pan and select different portions
      const imageAspectRatio = imageDimensions.width / imageDimensions.height
      let baseScale: number
      
      // Calculate scale needed to fit frame width and height  
      const scaleForWidth = frameWidth / imageDimensions.width
      const scaleForHeight = frameHeight / imageDimensions.height
      
      // Use the LARGER scale - this ensures the image is larger than the frame in at least one dimension
      // This allows panning to select different portions
      // The image will fit the frame in one dimension and extend beyond in the other
      baseScale = Math.max(scaleForWidth, scaleForHeight)
      
      // However, we don't want to upscale beyond original
      // Also ensure minimum scale for visibility
      baseScale = Math.min(Math.max(baseScale, 0.1), 1)
      
      // Ensure scale is valid
      if (!isFinite(baseScale) || baseScale <= 0) {
        baseScale = 1
      }
      
      // Apply zoom - when zoom > 1, image can be larger than frame
      const finalScale = baseScale * zoom
      // Allow scale up to 2x for zoom, but minimum 0.1
      const clampedScale = Math.min(Math.max(finalScale, 0.1), 2)
      setImageScale(clampedScale)
      
      // Initialize crop area based on what's visible in the fixed frame
      // Frame is centered, so calculate what portion of image is visible
      const frameCenterX = containerWidth / 2
      const frameCenterY = containerHeight / 2
      
      // Get current image position (use state value, not from closure)
      const currentImagePosition = imagePosition
      
      // Image position relative to frame center
      const imageDisplayWidth = imageDimensions.width * finalScale
      const imageDisplayHeight = imageDimensions.height * finalScale
      
      // Calculate crop area in image coordinates
      // What portion of the image is visible in the frame?
      const cropX = (frameCenterX - frameWidth / 2 - currentImagePosition.x) / finalScale
      const cropY = (frameCenterY - frameHeight / 2 - currentImagePosition.y) / finalScale
      const cropWidth = frameWidth / finalScale
      const cropHeight = frameHeight / finalScale
      
      // If we have existing crop data and haven't initialized, use it
      if (existingCropData && !hasInitializedRef.current) {
        // Calculate image position from existing crop data
        const existingCropCenterX = existingCropData.x + existingCropData.width / 2
        const existingCropCenterY = existingCropData.y + existingCropData.height / 2
        
        // Position image so existing crop center is at frame center
        const imageCenterX = imageDimensions.width / 2
        const imageCenterY = imageDimensions.height / 2
        
        const offsetX = (existingCropCenterX - imageCenterX) * finalScale
        const offsetY = (existingCropCenterY - imageCenterY) * finalScale
        
        setImagePosition({ x: -offsetX, y: -offsetY })
        setCropArea(existingCropData)
        hasInitializedRef.current = true
        return true
      }
      
      // Default: center the image in the frame
      if (!hasInitializedRef.current) {
        const cropAreaX = Math.max(0, Math.min(imageDimensions.width - cropWidth, cropX))
        const cropAreaY = Math.max(0, Math.min(imageDimensions.height - cropHeight, cropY))
        const finalCropWidth = Math.min(cropWidth, imageDimensions.width - cropAreaX)
        const finalCropHeight = Math.min(cropHeight, imageDimensions.height - cropAreaY)
        
        // Ensure we have valid dimensions
        if (finalCropWidth > 0 && finalCropHeight > 0) {
          setCropArea({
            x: cropAreaX,
            y: cropAreaY,
            width: finalCropWidth,
            height: finalCropHeight,
          })
          hasInitializedRef.current = true
          return true
        }
        return false
      } else {
        // Update crop area based on current image position
        const cropAreaX = Math.max(0, Math.min(imageDimensions.width - cropWidth, cropX))
        const cropAreaY = Math.max(0, Math.min(imageDimensions.height - cropHeight, cropY))
        const finalCropWidth = Math.min(cropWidth, imageDimensions.width - cropAreaX)
        const finalCropHeight = Math.min(cropHeight, imageDimensions.height - cropAreaY)
        
        if (finalCropWidth > 0 && finalCropHeight > 0) {
          setCropArea({
            x: cropAreaX,
            y: cropAreaY,
            width: finalCropWidth,
            height: finalCropHeight,
          })
          return true
        }
        return false
      }
    }

    let retryCount = 0
    const maxRetries = 20 // Increased retries
    
    const tryCalculate = () => {
      if (calculateSetup()) {
        return
      }
      
      retryCount++
      if (retryCount < maxRetries) {
        retryTimeoutRef.current = setTimeout(tryCalculate, 50)
      } else {
        // Fallback: set a default crop area if calculation fails
        const defaultCropWidth = Math.min(imageDimensions.width * 0.8, imageDimensions.width)
        const defaultCropHeight = Math.min(defaultCropWidth / selectedAspectRatio, imageDimensions.height)
        const finalCropWidth = Math.min(defaultCropWidth, imageDimensions.width)
        const finalCropHeight = Math.min(defaultCropHeight, imageDimensions.height)
        
        // Calculate a reasonable scale for fallback (fit to 800x600 container)
        const fallbackContainerWidth = 800
        const fallbackContainerHeight = 600
        const fallbackPadding = 40
        const fallbackAvailableWidth = fallbackContainerWidth - fallbackPadding * 2
        const fallbackAvailableHeight = fallbackContainerHeight - fallbackPadding * 2
        const fallbackFrameAspectRatio = selectedAspectRatio
        let fallbackFrameWidth: number
        let fallbackFrameHeight: number
        
        if (fallbackAvailableWidth / fallbackAvailableHeight > fallbackFrameAspectRatio) {
          fallbackFrameHeight = fallbackAvailableHeight
          fallbackFrameWidth = fallbackFrameHeight * fallbackFrameAspectRatio
        } else {
          fallbackFrameWidth = fallbackAvailableWidth
          fallbackFrameHeight = fallbackFrameWidth / fallbackFrameAspectRatio
        }
        
        const imageAspectRatio = imageDimensions.width / imageDimensions.height
        let fallbackBaseScale: number
        if (imageAspectRatio > fallbackFrameAspectRatio) {
          fallbackBaseScale = fallbackFrameHeight / imageDimensions.height
        } else {
          fallbackBaseScale = fallbackFrameWidth / imageDimensions.width
        }
        
        const fallbackScale = Math.min(Math.max(fallbackBaseScale * zoom, 0.1), 1)
        setImageScale(fallbackScale)
        
        setCropArea({
          x: Math.max(0, (imageDimensions.width - finalCropWidth) / 2),
          y: Math.max(0, (imageDimensions.height - finalCropHeight) / 2),
          width: finalCropWidth,
          height: finalCropHeight,
        })
        setContainerSize({ width: fallbackContainerWidth, height: fallbackContainerHeight })
        hasInitializedRef.current = true
      }
    }
    
    tryCalculate()
    
    // ResizeObserver for dynamic resizing
    let resizeObserver: ResizeObserver | null = null
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!hasInitializedRef.current) {
          calculateSetup()
        }
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
  }, [imageDimensions, selectedAspectRatio, zoom, existingCropData])

  // Calculate display values (before early return to avoid hooks issues)
  const containerWidth = containerSize.width || 800
  const containerHeight = containerSize.height || 600
  
  // Ensure imageScale is valid - use at least 0.1 to ensure image is visible
  const validImageScale = imageScale > 0 && isFinite(imageScale) ? Math.max(imageScale, 0.1) : 0.1
  
  // Calculate crop frame size (fixed in center)
  // Use responsive padding: smaller on mobile
  const padding = containerWidth < 640 ? 20 : 40
  const availableWidth = Math.max(0, containerWidth - padding * 2)
  const availableHeight = Math.max(0, containerHeight - padding * 2)
  const frameAspectRatio = selectedAspectRatio
  
  let frameWidth: number
  let frameHeight: number
  
  if (availableWidth > 0 && availableHeight > 0) {
    if (availableWidth / availableHeight > frameAspectRatio) {
      frameHeight = availableHeight
      frameWidth = frameHeight * frameAspectRatio
    } else {
      frameWidth = availableWidth
      frameHeight = frameWidth / frameAspectRatio
    }
  } else {
    // Fallback if container not ready
    frameWidth = 400
    frameHeight = frameWidth / frameAspectRatio
  }
  
  const frameCenterX = containerWidth / 2
  const frameCenterY = containerHeight / 2
  const frameLeft = frameCenterX - frameWidth / 2
  const frameTop = frameCenterY - frameHeight / 2
  
  // Image display size - ensure minimum size for visibility
  const imageDisplaySize = {
    width: Math.max(imageDimensions.width * validImageScale, 100),
    height: Math.max(imageDimensions.height * validImageScale, 100),
  }
  
  // Image position (centered + user pan offset) - ensure it's visible
  const imageCenterX = frameCenterX + imagePosition.x
  const imageCenterY = frameCenterY + imagePosition.y
  const imageLeft = imageCenterX - imageDisplaySize.width / 2
  const imageTop = imageCenterY - imageDisplaySize.height / 2
  
  // Debug logging to help diagnose issues (only log when key values change)
  useEffect(() => {
    if (hasInitializedRef.current) {
      logDebug('ImageCropModal state:', {
        containerSize,
        imageScale,
        imagePosition,
        cropArea: cropArea ? { ...cropArea } : null,
      })
    }
  }, [containerSize.width, containerSize.height, imageScale, imagePosition.x, imagePosition.y, imageSrc, imageDimensions.width, imageDimensions.height, cropArea?.x, cropArea?.y, cropArea?.width, cropArea?.height])
  
  // Update crop area based on what's visible in the frame (only after initialization)
  useEffect(() => {
    if (!cropArea || !hasInitializedRef.current || !containerSize.width || !containerSize.height) return
    
    // Recalculate frame dimensions to avoid dependency on computed values
    // Use responsive padding: smaller on mobile
    const padding = containerSize.width < 640 ? 20 : 40
    const availableWidth = Math.max(0, containerSize.width - padding * 2)
    const availableHeight = Math.max(0, containerSize.height - padding * 2)
    const frameAspectRatio = selectedAspectRatio
    
    let currentFrameWidth: number
    let currentFrameHeight: number
    
    if (availableWidth > 0 && availableHeight > 0) {
      if (availableWidth / availableHeight > frameAspectRatio) {
        currentFrameHeight = availableHeight
        currentFrameWidth = currentFrameHeight * frameAspectRatio
      } else {
        currentFrameWidth = availableWidth
        currentFrameHeight = currentFrameWidth / frameAspectRatio
      }
    } else {
      currentFrameWidth = 400
      currentFrameHeight = currentFrameWidth / frameAspectRatio
    }
    
    const currentFrameCenterX = containerSize.width / 2
    const currentFrameCenterY = containerSize.height / 2
    const currentFrameLeft = currentFrameCenterX - currentFrameWidth / 2
    const currentFrameTop = currentFrameCenterY - currentFrameHeight / 2
    
    const validImageScale = imageScale > 0 && isFinite(imageScale) ? Math.max(imageScale, 0.1) : 0.1
    const currentImageDisplaySize = {
      width: Math.max(imageDimensions.width * validImageScale, 100),
      height: Math.max(imageDimensions.height * validImageScale, 100),
    }
    
    const currentImageCenterX = currentFrameCenterX + imagePosition.x
    const currentImageCenterY = currentFrameCenterY + imagePosition.y
    const currentImageLeft = currentImageCenterX - currentImageDisplaySize.width / 2
    const currentImageTop = currentImageCenterY - currentImageDisplaySize.height / 2
    
    // Calculate what portion of image is visible in the fixed frame
    // Frame position in container coordinates (display pixels)
    // Image position in container coordinates (display pixels)
    // Convert to original image coordinates by dividing by scale
    
    // The frame shows a portion of the image. We need to find:
    // 1. Where the frame's top-left corner is relative to the image's top-left (in display coords)
    // 2. Convert that to original image coordinates
    // 3. The frame size in original image coordinates
    
    // Frame's position relative to image's top-left (in display coordinates)
    const frameRelativeToImageX = currentFrameLeft - currentImageLeft
    const frameRelativeToImageY = currentFrameTop - currentImageTop
    
    // Convert frame position and size to original image coordinates
    // The crop area is what's visible through the frame in the original image
    
    // Calculate the intersection of the frame and the image in display coordinates
    const frameRight = currentFrameLeft + currentFrameWidth
    const frameBottom = currentFrameTop + currentFrameHeight
    const imageRight = currentImageLeft + currentImageDisplaySize.width
    const imageBottom = currentImageTop + currentImageDisplaySize.height
    
    // Find the intersection rectangle (what's actually visible)
    const visibleLeft = Math.max(currentFrameLeft, currentImageLeft)
    const visibleTop = Math.max(currentFrameTop, currentImageTop)
    const visibleRight = Math.min(frameRight, imageRight)
    const visibleBottom = Math.min(frameBottom, imageBottom)
    
    // Calculate visible size in display coordinates
    const visibleWidth = Math.max(0, visibleRight - visibleLeft)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)
    
    // Convert visible area position relative to image to original image coordinates
    const visibleRelativeToImageX = visibleLeft - currentImageLeft
    const visibleRelativeToImageY = visibleTop - currentImageTop
    
    // Convert to original image coordinates
    let cropX = visibleRelativeToImageX / validImageScale
    let cropY = visibleRelativeToImageY / validImageScale
    let cropWidth = visibleWidth / validImageScale
    let cropHeight = visibleHeight / validImageScale
    
    // Ensure crop area is within image bounds
    // Clamp crop area to stay within image boundaries
    const maxCropX = imageDimensions.width - cropWidth
    const maxCropY = imageDimensions.height - cropHeight
    
    // Clamp position to valid range
    cropX = Math.max(0, Math.min(maxCropX, cropX))
    cropY = Math.max(0, Math.min(maxCropY, cropY))
    
    // Ensure crop dimensions don't exceed image dimensions
    // If the calculated crop area is larger than the image, clamp it
    if (cropWidth > imageDimensions.width) {
      cropWidth = imageDimensions.width
      cropX = 0 // If width is full image, start at 0
    }
    if (cropHeight > imageDimensions.height) {
      cropHeight = imageDimensions.height
      cropY = 0 // If height is full image, start at 0
    }
    
    // Final bounds check - ensure crop area fits within image
    if (cropX + cropWidth > imageDimensions.width) {
      cropWidth = imageDimensions.width - cropX
    }
    if (cropY + cropHeight > imageDimensions.height) {
      cropHeight = imageDimensions.height - cropY
    }
    
    // Ensure crop dimensions are positive
    cropWidth = Math.max(0, cropWidth)
    cropHeight = Math.max(0, cropHeight)
    
    logDebug('Crop area calculation:', {
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    })
    
    // Final crop area (already constrained above)
    const constrainedX = cropX
    const constrainedY = cropY
    const finalWidth = cropWidth
    const finalHeight = cropHeight
    
    // Only update if dimensions are valid and actually changed
    if (finalWidth > 0 && finalHeight > 0) {
      const newCropArea = {
        x: constrainedX,
        y: constrainedY,
        width: finalWidth,
        height: finalHeight,
      }
      
      // Only update if values actually changed to prevent infinite loops
      // Use smaller threshold (0.01 instead of 0.1) to catch smaller movements
      if (
        !cropArea ||
        Math.abs(cropArea.x - newCropArea.x) > 0.01 ||
        Math.abs(cropArea.y - newCropArea.y) > 0.01 ||
        Math.abs(cropArea.width - newCropArea.width) > 0.01 ||
        Math.abs(cropArea.height - newCropArea.height) > 0.01
      ) {
        logDebug('Updating crop area:', newCropArea)
        setCropArea(newCropArea)
      }
    }
  }, [imagePosition.x, imagePosition.y, imageScale, containerSize.width, containerSize.height, selectedAspectRatio, imageDimensions.width, imageDimensions.height])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    e.preventDefault()
    e.stopPropagation()
    
    // Always drag the image (Instagram style)
    setIsDragging(true)
    const rect = containerRef.current.getBoundingClientRect()
    // Calculate drag start relative to current image position
    // We need to account for the frame center offset
    const containerWidth = containerSize.width || 800
    const containerHeight = containerSize.height || 600
    const frameCenterX = containerWidth / 2
    const frameCenterY = containerHeight / 2
    
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Calculate where mouse is relative to image center
    const imageCenterX = frameCenterX + imagePosition.x
    const imageCenterY = frameCenterY + imagePosition.y
    
    setDragStart({
      x: mouseX - imageCenterX,
      y: mouseY - imageCenterY,
    })
  }, [imagePosition, containerSize])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !isDragging) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Calculate new image center position based on drag
    const newImageCenterX = mouseX - dragStart.x
    const newImageCenterY = mouseY - dragStart.y
    
    // Get current frame center
    const containerWidth = containerSize.width || 800
    const containerHeight = containerSize.height || 600
    const frameCenterX = containerWidth / 2
    const frameCenterY = containerHeight / 2
    
    // Calculate frame dimensions
    // Use responsive padding: smaller on mobile
    const padding = containerWidth < 640 ? 20 : 40
    const availableWidth = Math.max(0, containerWidth - padding * 2)
    const availableHeight = Math.max(0, containerHeight - padding * 2)
    const frameAspectRatio = selectedAspectRatio
    
    let currentFrameWidth: number
    let currentFrameHeight: number
    
    if (availableWidth > 0 && availableHeight > 0) {
      if (availableWidth / availableHeight > frameAspectRatio) {
        currentFrameHeight = availableHeight
        currentFrameWidth = currentFrameHeight * frameAspectRatio
      } else {
        currentFrameWidth = availableWidth
        currentFrameHeight = currentFrameWidth / frameAspectRatio
      }
    } else {
      currentFrameWidth = 400
      currentFrameHeight = currentFrameWidth / frameAspectRatio
    }
    
    // Calculate image display size
    const validImageScale = imageScale > 0 && isFinite(imageScale) ? Math.max(imageScale, 0.1) : 0.1
    const imageDisplayWidth = imageDimensions.width * validImageScale
    const imageDisplayHeight = imageDimensions.height * validImageScale
    
    // Calculate image position offset from frame center
    const newImagePositionX = newImageCenterX - frameCenterX
    const newImagePositionY = newImageCenterY - frameCenterY
    
    // Constrain image position so crop frame always shows valid portion
    const minX = -imageDisplayWidth + currentFrameWidth / 2
    const maxX = currentFrameWidth / 2
    const minY = -imageDisplayHeight + currentFrameHeight / 2
    const maxY = currentFrameHeight / 2
    
    setImagePosition({
      x: Math.max(minX, Math.min(maxX, newImagePositionX)),
      y: Math.max(minY, Math.min(maxY, newImagePositionY)),
    })
  }, [isDragging, dragStart, imageScale, imageDimensions, containerSize, selectedAspectRatio])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Global mouse events for dragging image
  useEffect(() => {
    if (isDragging && containerRef.current) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        // Calculate new image center position based on drag
        const newImageCenterX = mouseX - dragStart.x
        const newImageCenterY = mouseY - dragStart.y
        
        // Get current frame center
        const containerWidth = containerSize.width || 800
        const containerHeight = containerSize.height || 600
        const frameCenterX = containerWidth / 2
        const frameCenterY = containerHeight / 2
        
        // Calculate frame dimensions
        // Use responsive padding: smaller on mobile
        const padding = containerWidth < 640 ? 20 : 40
        const availableWidth = Math.max(0, containerWidth - padding * 2)
        const availableHeight = Math.max(0, containerHeight - padding * 2)
        const frameAspectRatio = selectedAspectRatio
        
        let currentFrameWidth: number
        let currentFrameHeight: number
        
        if (availableWidth > 0 && availableHeight > 0) {
          if (availableWidth / availableHeight > frameAspectRatio) {
            currentFrameHeight = availableHeight
            currentFrameWidth = currentFrameHeight * frameAspectRatio
          } else {
            currentFrameWidth = availableWidth
            currentFrameHeight = currentFrameWidth / frameAspectRatio
          }
        } else {
          currentFrameWidth = 400
          currentFrameHeight = currentFrameWidth / frameAspectRatio
        }
        
        // Calculate image display size
        const validImageScale = imageScale > 0 && isFinite(imageScale) ? Math.max(imageScale, 0.1) : 0.1
        const imageDisplayWidth = imageDimensions.width * validImageScale
        const imageDisplayHeight = imageDimensions.height * validImageScale
        
        // Calculate image position offset from frame center
        const newImagePositionX = newImageCenterX - frameCenterX
        const newImagePositionY = newImageCenterY - frameCenterY
        
        // Constrain image position so crop frame always shows valid portion
        const minX = -imageDisplayWidth + currentFrameWidth / 2
        const maxX = currentFrameWidth / 2
        const minY = -imageDisplayHeight + currentFrameHeight / 2
        const maxY = currentFrameHeight / 2
        
        setImagePosition({
          x: Math.max(minX, Math.min(maxX, newImagePositionX)),
          y: Math.max(minY, Math.min(maxY, newImagePositionY)),
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
  }, [isDragging, dragStart, imageScale, imageDimensions, containerSize, selectedAspectRatio])

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

  const handleCrop = () => {
    if (!cropArea) {
      logError('No crop area defined')
      return
    }

    // Return original image URL + metadata (no file cropping)
    const metadata = {
      cropData: cropArea,
      aspectRatio: selectedAspectRatio,
    }
    
    logDebug('Applying crop:', { originalImageSrc })
    onCrop(originalImageSrc, metadata)
    setIsSaved(true) // Mark as saved - show success message
    setHasUnsavedChanges(false) // No unsaved changes after saving
    setSavedCropArea(cropArea) // Remember what was saved
    setSavedAspectRatio(selectedAspectRatio) // Remember what aspect ratio was saved
    showToast('Updated has been saved', 'success')
  }

  const handleClose = () => {
    // Close button just closes the modal - doesn't cancel changes
    // Changes are already saved if user clicked "Apply"
    if (onClose) {
      onClose()
    } else {
      onCancel() // Fallback to cancel if no close handler
    }
  }

  // Track if there are unsaved changes after initial save
  useEffect(() => {
    if (isSaved && cropArea && savedCropArea && savedAspectRatio !== null) {
      // Check if crop area has changed
      const cropChanged = 
        Math.abs(cropArea.x - savedCropArea.x) > 0.01 ||
        Math.abs(cropArea.y - savedCropArea.y) > 0.01 ||
        Math.abs(cropArea.width - savedCropArea.width) > 0.01 ||
        Math.abs(cropArea.height - savedCropArea.height) > 0.01
      
      // Check if aspect ratio has changed
      const aspectRatioChanged = Math.abs(selectedAspectRatio - savedAspectRatio) > 0.001
      
      if (cropChanged || aspectRatioChanged) {
        setHasUnsavedChanges(true)
      } else {
        setHasUnsavedChanges(false)
      }
    }
  }, [cropArea, selectedAspectRatio, isSaved, savedCropArea, savedAspectRatio])

  const handleReset = () => {
    // Reset to original: reset zoom and image position
    setZoom(1.0)
    setImagePosition({ x: 0, y: 0 })
    setSelectedAspectRatio(recommendedAspectRatio || 0.75) // Reset to recommended aspect ratio
    hasInitializedRef.current = false // Force recalculation
    setIsSaved(false) // Reset saved state
    setHasUnsavedChanges(false) // Reset unsaved changes
    setSavedCropArea(null) // Clear saved crop area
    setSavedAspectRatio(null) // Clear saved aspect ratio
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

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl max-h-[95vh] bg-white flex flex-col overflow-hidden my-auto" style={{ maxHeight: '95vh' }}>
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-eco-green">Crop Image for All Devices</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Select aspect ratio, adjust zoom, and preview how it looks on different devices
              </p>
            </div>
            {isSaved && (
              <div className={`ml-4 px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2 ${
                hasUnsavedChanges 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                <span>✓</span>
                <span>{hasUnsavedChanges ? 'Unsaved Changes' : 'Image Saved'}</span>
              </div>
            )}
          </div>
          
          {/* Aspect Ratio Selector */}
          <div className="mt-4">
            <label className="block text-xs font-medium mb-2">Aspect Ratio</label>
            {availableAspectRatios.length > 1 ? (
              <>
                <select
                  value={selectedAspectRatio}
                  onChange={(e) => {
                    const newRatio = parseFloat(e.target.value)
                    setSelectedAspectRatio(newRatio)
                  }}
                  className="w-full text-sm border rounded px-2 py-1"
                >
                  {availableAspectRatios.map(ratio => (
                    <option key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{selectedAspectRatioDescription}</p>
              </>
            ) : (
              <p className="text-sm text-gray-700">
                {availableAspectRatios[0]?.label}
                {selectedAspectRatioDescription ? (
                  <span className="text-xs text-gray-500 ml-2">{selectedAspectRatioDescription}</span>
                ) : null}
              </p>
            )}
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

        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg flex-1"
            style={{
              minHeight: '400px',
              position: 'relative',
              overflow: 'hidden', // Clip content - no scrolling needed
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Instagram-style: Fixed crop frame, image moves behind it */}
            <div
              className="absolute inset-0"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
                overflow: 'hidden', // Clip image to container bounds
              }}
            >
              {/* Image - can be dragged and zoomed */}
              <div
                className="absolute"
                style={{
                  left: `${imageLeft}px`,
                  top: `${imageTop}px`,
                  width: `${Math.max(imageDisplaySize.width, 100)}px`,
                  height: `${Math.max(imageDisplaySize.height, 100)}px`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  zIndex: 1, // Base layer - image should be visible
                }}
                onMouseDown={handleMouseDown}
              >
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  className="block"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    display: 'block', // Ensure image is displayed
                  }}
                  draggable={false}
                  onError={(e) => {
                    logError('Image failed to load:', { imageSrc, error: e })
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement
                    logDebug('Image loaded successfully:', {
                      src: imageSrc,
                      naturalWidth: img.naturalWidth,
                      naturalHeight: img.naturalHeight,
                      displaySize: imageDisplaySize,
                      position: { left: imageLeft, top: imageTop },
                      containerSize,
                    })
                  }}
                />
              </div>
              
              {/* Overlay - darken areas outside crop frame */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: '0',
                  top: '0',
                  width: `${containerWidth}px`,
                  height: `${containerHeight}px`,
                  zIndex: 2, // Above image to darken areas outside crop
                  background: `
                    linear-gradient(to right, 
                      rgba(0,0,0,0.6) 0%, 
                      rgba(0,0,0,0.6) ${(frameLeft / containerWidth) * 100}%,
                      transparent ${(frameLeft / containerWidth) * 100}%,
                      transparent ${((frameLeft + frameWidth) / containerWidth) * 100}%,
                      rgba(0,0,0,0.6) ${((frameLeft + frameWidth) / containerWidth) * 100}%,
                      rgba(0,0,0,0.6) 100%
                    ),
                    linear-gradient(to bottom, 
                      rgba(0,0,0,0.6) 0%, 
                      rgba(0,0,0,0.6) ${(frameTop / containerHeight) * 100}%,
                      transparent ${(frameTop / containerHeight) * 100}%,
                      transparent ${((frameTop + frameHeight) / containerHeight) * 100}%,
                      rgba(0,0,0,0.6) ${((frameTop + frameHeight) / containerHeight) * 100}%,
                      rgba(0,0,0,0.6) 100%
                    )
                  `,
                }}
              />

              {/* Safe Zone Overlay - inside crop frame */}
              {showSafeZone && cropArea && (() => {
                // Calculate current crop area in real-time from image position (for smooth updates during dragging)
                // This ensures safe zone updates smoothly as user drags, not just when state updates
                const padding = containerSize.width < 640 ? 20 : 40
                const availableWidth = Math.max(0, containerSize.width - padding * 2)
                const availableHeight = Math.max(0, containerSize.height - padding * 2)
                const frameAspectRatio = selectedAspectRatio
                
                let currentFrameWidth: number
                let currentFrameHeight: number
                
                if (availableWidth > 0 && availableHeight > 0) {
                  if (availableWidth / availableHeight > frameAspectRatio) {
                    currentFrameHeight = availableHeight
                    currentFrameWidth = currentFrameHeight * frameAspectRatio
                  } else {
                    currentFrameWidth = availableWidth
                    currentFrameHeight = currentFrameWidth / frameAspectRatio
                  }
                } else {
                  currentFrameWidth = 400
                  currentFrameHeight = currentFrameWidth / frameAspectRatio
                }
                
                const currentFrameCenterX = containerSize.width / 2
                const currentFrameCenterY = containerSize.height / 2
                const currentFrameLeft = currentFrameCenterX - currentFrameWidth / 2
                const currentFrameTop = currentFrameCenterY - currentFrameHeight / 2
                
                const validImageScale = imageScale > 0 && isFinite(imageScale) ? Math.max(imageScale, 0.1) : 0.1
                const currentImageDisplaySize = {
                  width: Math.max(imageDimensions.width * validImageScale, 100),
                  height: Math.max(imageDimensions.height * validImageScale, 100),
                }
                
                const currentImageCenterX = currentFrameCenterX + imagePosition.x
                const currentImageCenterY = currentFrameCenterY + imagePosition.y
                const currentImageLeft = currentImageCenterX - currentImageDisplaySize.width / 2
                const currentImageTop = currentImageCenterY - currentImageDisplaySize.height / 2
                
                // Calculate current crop area in image coordinates (real-time, not from state)
                const currentCropX = Math.max(0, Math.min(imageDimensions.width - (currentFrameWidth / validImageScale), (currentFrameLeft - currentImageLeft) / validImageScale))
                const currentCropY = Math.max(0, Math.min(imageDimensions.height - (currentFrameHeight / validImageScale), (currentFrameTop - currentImageTop) / validImageScale))
                const currentCropWidth = Math.min(currentFrameWidth / validImageScale, imageDimensions.width - currentCropX)
                const currentCropHeight = Math.min(currentFrameHeight / validImageScale, imageDimensions.height - currentCropY)
                
                // Calculate safe zone from current crop area (real-time)
                const currentCropAspect = currentCropWidth / currentCropHeight
                const mobileAspect = 0.5625
                const desktopAspect = 1.778
                
                let safeWidth: number
                let safeHeight: number
                
                if (currentCropAspect > mobileAspect) {
                  safeHeight = currentCropHeight
                  safeWidth = safeHeight * mobileAspect
                } else {
                  safeWidth = currentCropWidth
                  safeHeight = safeWidth / desktopAspect
                }
                
                const safeZoneX = currentCropX + (currentCropWidth - safeWidth) / 2
                const safeZoneY = currentCropY + (currentCropHeight - safeHeight) / 2
                
                // Convert safe zone to display coordinates
                const safeZoneDisplayX = safeZoneX * validImageScale
                const safeZoneDisplayY = safeZoneY * validImageScale
                const safeZoneDisplayWidth = safeWidth * validImageScale
                const safeZoneDisplayHeight = safeHeight * validImageScale
                
                // Position relative to image (which is positioned at imageLeft, imageTop)
                const safeZoneX_display = imageLeft + safeZoneDisplayX
                const safeZoneY_display = imageTop + safeZoneDisplayY
                
                return (
                  <div
                    className="absolute border-2 border-yellow-400 border-dashed pointer-events-none z-20"
                    style={{
                      left: `${safeZoneX_display}px`,
                      top: `${safeZoneY_display}px`,
                      width: `${safeZoneDisplayWidth}px`,
                      height: `${safeZoneDisplayHeight}px`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 text-xs text-yellow-600 bg-yellow-100 px-1 rounded whitespace-nowrap">
                      Safe Zone
                    </div>
                  </div>
                )
              })()}


              {/* Crop frame - fixed in center (Instagram style) */}
              <div
                className="absolute border-2 border-white shadow-lg pointer-events-none"
                style={{
                  left: `${frameLeft}px`,
                  top: `${frameTop}px`,
                  width: `${frameWidth}px`,
                  height: `${frameHeight}px`,
                  zIndex: 10, // Above everything
                }}
              />
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              Reset to Original
            </Button>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
                {isSaved ? 'Close' : 'Cancel'}
              </Button>
              <Button 
                className="bg-eco-green hover:bg-green-600 flex-1 sm:flex-none" 
                onClick={handleCrop}
                disabled={!cropArea}
              >
                {isSaved && !hasUnsavedChanges ? 'Saved ✓' : 'Apply'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


