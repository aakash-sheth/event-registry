'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingElementType } from './FloatingElement'
import { useElementDrag } from '@/hooks/useElementDrag'

interface TextElementProps {
  element: FloatingElementType
  isSelected: boolean
  onSelect: () => void
  onUpdate: (element: FloatingElementType) => void
  onDelete: () => void
  motionEnabled: boolean
  canvasRef: React.RefObject<HTMLElement>
}

export default function TextElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  motionEnabled,
  canvasRef,
}: TextElementProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(element.label || 'Double click to edit')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    position,
    size,
    rotation,
    containerRef,
    handleDragStart,
    handleResizeStart,
    handleRotateStart,
  } = useElementDrag({
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
    enabled: !isEditing, // Disable drag when editing text
  })

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = () => {
    if (isSelected) {
      setIsEditing(true)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    onUpdate({ ...element, label: text })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleBlur()
    }
    if (e.key === 'Escape') {
      setText(element.label || '')
      setIsEditing(false)
    }
  }

  const motionVariants = {
    float: {
      y: [0, -4, 0],
      transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' as const },
    },
    pulse: {
      scale: [1, 1.04, 1],
      transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' as const },
    },
    sparkle: {
      opacity: [1, 0.8, 1],
      scale: [1, 1.1, 1],
      transition: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' as const },
    },
    none: {},
  }

  const textStyle: React.CSSProperties = {
    fontSize: element.fontSize || 24,
    fontFamily: element.fontFamily || 'inherit',
    fontWeight: element.fontWeight || 'normal',
    color: element.color || '#000000',
    textAlign: element.textAlign || 'left',
    width: `${size.w}px`,
    minWidth: '50px',
    maxWidth: '100%',
  }

  return (
    <motion.div
      ref={containerRef}
      className={`absolute cursor-move ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        zIndex: isSelected ? 100 : 10,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={!isEditing ? handleDragStart : undefined}
      onTouchStart={!isEditing ? handleDragStart : undefined}
      animate={motionEnabled && element.motion !== 'none' ? element.motion : 'none'}
      variants={motionVariants}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={textStyle}
          className="bg-transparent border-2 border-blue-500 rounded px-2 py-1 resize-none outline-none"
          autoFocus
        />
      ) : (
        <div
          style={textStyle}
          className="px-2 py-1 whitespace-pre-wrap break-words"
        >
          {text || 'Double click to edit'}
        </div>
      )}

      {isSelected && !isEditing && (
        <>
          {/* Delete Handle */}
          <Button
            variant="ghost"
            className="absolute -top-3 -right-3 h-6 w-6 rounded-full p-0 bg-red-500 hover:bg-red-600 text-white"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Rotate Handle */}
          <Button
            variant="outline"
            className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white p-0"
            onMouseDown={handleRotateStart}
            onTouchStart={handleRotateStart}
          >
            <RotateCw className="h-3 w-3" />
          </Button>

          {/* Resize Handle */}
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            onTouchStart={(e) => handleResizeStart(e, 'se')}
          />
        </>
      )}
    </motion.div>
  )
}

