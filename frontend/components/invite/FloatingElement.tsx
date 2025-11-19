'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, RotateCw } from 'lucide-react'
import { useElementDrag } from '@/hooks/useElementDrag'
import { FloatingElement as FloatingElementType } from '@/lib/invite/schema'
import { Button } from '@/components/ui/button'

interface FloatingElementProps {
  element: FloatingElementType
  isSelected?: boolean
  onSelect?: () => void
  onUpdate: (element: FloatingElementType) => void
  onDelete?: () => void
  motionEnabled?: boolean
  isEditing?: boolean
}

const motionVariants = {
  float: {
    y: [0, -4, 0],
    transition: {
      repeat: Infinity,
      duration: 3,
      ease: 'easeInOut',
    },
  },
  pulse: {
    scale: [1, 1.04, 1],
    transition: {
      repeat: Infinity,
      duration: 2.5,
      ease: 'easeInOut',
    },
  },
  sparkle: {
    opacity: [1, 0.8, 1],
    scale: [1, 1.1, 1],
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'easeInOut',
    },
  },
  none: {},
}

export default function FloatingElement({
  element,
  isSelected = false,
  onSelect,
  onUpdate,
  onDelete,
  motionEnabled = true,
  isEditing = true,
}: FloatingElementProps) {
  const [isHovered, setIsHovered] = useState(false)
  const showHandles = isEditing && (isSelected || isHovered)

  const { position, size, rotation, containerRef, handleDragStart, handleResizeStart, handleRotateStart } = useElementDrag({
    initialPosition: element.position,
    initialSize: element.size,
    initialRotation: element.rotation || 0,
    onUpdate: (pos, sz, rot) => {
      onUpdate({
        ...element,
        position: pos,
        size: sz,
        rotation: rot,
      })
    },
    enabled: isEditing,
  })

  const motionType = motionEnabled && element.motion !== 'none' ? element.motion : 'none'

  const renderContent = () => {
    switch (element.type) {
      case 'button':
        return (
          <Button
            className="px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (element.link && !isEditing) {
                window.location.href = element.link
              }
            }}
          >
            {element.label || 'Click Me'}
          </Button>
        )
      
      case 'emoji':
      case 'sticker':
        return (
          <div className="text-6xl select-none" style={{ fontSize: `${size.w / 2}px` }}>
            {element.src || '🎉'}
          </div>
        )
      
      case 'text':
        return (
          <div
            style={{
              fontSize: element.fontSize || 24,
              fontFamily: element.fontFamily || 'inherit',
              fontWeight: element.fontWeight || 'normal',
              color: element.color || '#000000',
              textAlign: element.textAlign || 'left',
            }}
            className="px-2 py-1 whitespace-pre-wrap break-words"
          >
            {element.label || 'Text'}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <motion.div
      ref={containerRef}
      className="absolute cursor-move"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${size.w}px`,
        height: `${size.h}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        zIndex: isSelected ? 100 : 10,
      }}
      variants={motionVariants}
      animate={motionType}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      {/* Content */}
      <div className="relative w-full h-full flex items-center justify-center">
        {renderContent()}
      </div>

      {/* Selection outline */}
      {showHandles && (
        <div className="absolute inset-0 border-2 border-eco-green border-dashed pointer-events-none" />
      )}

      {/* Resize handles */}
      {showHandles && isEditing && (
        <>
          {/* Corner handles */}
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <div
              key={corner}
              className="absolute w-4 h-4 bg-eco-green border-2 border-white rounded-full cursor-nwse-resize shadow-md"
              style={{
                [corner.includes('n') ? 'top' : 'bottom']: '-8px',
                [corner.includes('w') ? 'left' : 'right']: '-8px',
              }}
              onMouseDown={(e) => handleResizeStart(e, corner as 'nw' | 'ne' | 'sw' | 'se')}
              onTouchStart={(e) => handleResizeStart(e, corner as 'nw' | 'ne' | 'sw' | 'se')}
            />
          ))}

          {/* Rotate handle */}
          <div
            className="absolute w-6 h-6 bg-eco-green border-2 border-white rounded-full cursor-grab shadow-md flex items-center justify-center"
            style={{
              top: '-32px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            onMouseDown={handleRotateStart}
            onTouchStart={handleRotateStart}
          >
            <RotateCw className="w-3 h-3 text-white" />
          </div>

          {/* Delete button */}
          {onDelete && (
            <button
              className="absolute -top-8 -right-8 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </motion.div>
  )
}

