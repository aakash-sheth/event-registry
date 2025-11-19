'use client'

import { ReactNode } from 'react'
import BackgroundLayer from './BackgroundLayer'

interface CanvasAreaProps {
  backgroundUrl?: string | null
  children: ReactNode
  className?: string
  showOverlay?: boolean
  onBackgroundClick?: () => void
}

export default function CanvasArea({
  backgroundUrl,
  children,
  className = '',
  showOverlay = false,
  onBackgroundClick,
}: CanvasAreaProps) {
  return (
    <div
      className={`relative w-full ${backgroundUrl ? 'bg-gray-100' : 'bg-gradient-to-br from-eco-beige to-green-50'} ${className}`}
      style={{
        aspectRatio: '3 / 4',
        minHeight: '500px',
        maxHeight: '90vh',
        overflow: 'hidden',
        border: '2px dashed #ccc',
        borderRadius: '8px',
      }}
      onClick={onBackgroundClick}
    >
      {backgroundUrl ? (
        <BackgroundLayer backgroundUrl={backgroundUrl} overlay={showOverlay} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <p className="text-lg mb-2">No background image</p>
            <p className="text-sm">Add text, stickers, and elements to create your invitation</p>
          </div>
        </div>
      )}
      
      {/* Floating elements container */}
      <div className="absolute inset-0">
        <div className="relative w-full h-full">
          {children}
        </div>
      </div>
    </div>
  )
}

