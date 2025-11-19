import React, { useState, useRef, useCallback } from 'react'

interface Position {
  x: number
  y: number
}

interface Size {
  w: number
  h: number
}

interface UseElementDragProps {
  initialPosition: Position
  initialSize: Size
  initialRotation?: number
  onUpdate: (position: Position, size: Size, rotation?: number) => void
  enabled?: boolean
}

export function useElementDrag({
  initialPosition,
  initialSize,
  initialRotation = 0,
  onUpdate,
  enabled = true,
}: UseElementDragProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [position, setPosition] = useState(initialPosition)
  const [size, setSize] = useState(initialSize)
  const [rotation, setRotation] = useState(initialRotation)
  
  const dragStartPos = useRef<Position>({ x: 0, y: 0 })
  const resizeStartSize = useRef<Size>({ w: 0, h: 0 })
  const rotateStartAngle = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!enabled) return
    
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    // Find the canvas container (parent with class 'relative w-full h-full')
    const canvasContainer = (e.currentTarget as HTMLElement).closest('.relative.w-full.h-full') as HTMLElement || containerRef.current
    
    if (canvasContainer) {
      const rect = canvasContainer.getBoundingClientRect()
      const elementRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      dragStartPos.current = {
        x: clientX - elementRect.left - (elementRect.width / 2),
        y: clientY - elementRect.top - (elementRect.height / 2),
      }
    }
  }, [enabled])

  const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    // Find the canvas container
    const canvasContainer = containerRef.current?.closest('.relative.w-full.h-full') as HTMLElement || containerRef.current
    
    if (canvasContainer) {
      const rect = canvasContainer.getBoundingClientRect()
      const newX = ((clientX - rect.left - dragStartPos.current.x) / rect.width) * 100
      const newY = ((clientY - rect.top - dragStartPos.current.y) / rect.height) * 100
      
      // Clamp to canvas bounds
      const clampedX = Math.max(0, Math.min(100, newX))
      const clampedY = Math.max(0, Math.min(100, newY))
      
      const newPosition = { x: clampedX, y: clampedY }
      setPosition(newPosition)
      onUpdate(newPosition, size, rotation)
    }
  }, [isDragging, size, rotation, onUpdate])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, corner: 'se' | 'sw' | 'ne' | 'nw') => {
    if (!enabled) return
    
    e.stopPropagation()
    setIsResizing(true)
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    resizeStartSize.current = { ...size }
    dragStartPos.current = { x: clientX, y: clientY }
  }, [enabled, size])

  const handleResize = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing || !containerRef.current) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const deltaX = clientX - dragStartPos.current.x
    const deltaY = clientY - dragStartPos.current.y
    
    const rect = containerRef.current.getBoundingClientRect()
    const scaleX = rect.width / 100
    const scaleY = rect.height / 100
    
    const newW = Math.max(20, resizeStartSize.current.w + (deltaX / scaleX))
    const newH = Math.max(20, resizeStartSize.current.h + (deltaY / scaleY))
    
    const newSize = { w: newW, h: newH }
    setSize(newSize)
    onUpdate(position, newSize, rotation)
  }, [isResizing, position, rotation, onUpdate])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  const handleRotateStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!enabled) return
    
    e.stopPropagation()
    setIsRotating(true)
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + (position.x / 100) * rect.width
      const centerY = rect.top + (position.y / 100) * rect.height
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      
      const startAngle = Math.atan2(clientY - centerY, clientX - centerX)
      rotateStartAngle.current = startAngle - (rotation * Math.PI / 180)
    }
  }, [enabled, position, rotation])

  const handleRotate = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isRotating || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + (position.x / 100) * rect.width
    const centerY = rect.top + (position.y / 100) * rect.height
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const angle = Math.atan2(clientY - centerY, clientX - centerX)
    const newRotation = ((angle - rotateStartAngle.current) * 180 / Math.PI) % 360
    
    setRotation(newRotation)
    onUpdate(position, size, newRotation)
  }, [isRotating, position, size, onUpdate])

  const handleRotateEnd = useCallback(() => {
    setIsRotating(false)
  }, [])

  // Attach global event listeners
  React.useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      const handleMove = (e: MouseEvent | TouchEvent) => {
        if (isDragging) handleDrag(e)
        if (isResizing) handleResize(e)
        if (isRotating) handleRotate(e)
      }
      
      const handleEnd = () => {
        if (isDragging) handleDragEnd()
        if (isResizing) handleResizeEnd()
        if (isRotating) handleRotateEnd()
      }
      
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleMove)
        document.removeEventListener('touchend', handleEnd)
      }
    }
  }, [isDragging, isResizing, isRotating, handleDrag, handleResize, handleRotate, handleDragEnd, handleResizeEnd, handleRotateEnd])

  return {
    position,
    size,
    rotation,
    isDragging,
    isResizing,
    isRotating,
    containerRef,
    handleDragStart,
    handleResizeStart,
    handleRotateStart,
  }
}

