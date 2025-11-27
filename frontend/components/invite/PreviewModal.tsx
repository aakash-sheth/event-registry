'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CanvasArea from './CanvasArea'
import FloatingElement, { FloatingElementType } from './FloatingElement'

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  backgroundUrl: string
  elements: FloatingElementType[]
  motionEnabled: boolean
  eventSlug?: string
}

export default function PreviewModal({
  isOpen,
  onClose,
  backgroundUrl,
  elements,
  motionEnabled,
  eventSlug,
}: PreviewModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* Preview canvas */}
        <div className="w-full" style={{ aspectRatio: '3 / 4' }}>
          <CanvasArea backgroundUrl={backgroundUrl} showOverlay={false}>
            {elements.map((element) => {
              // Add links for buttons
              const elementWithLink = element.type === 'button' 
                ? {
                    ...element,
                    link: element.label?.toLowerCase().includes('rsvp')
                      ? `/event/${eventSlug}/rsvp`
                      : element.label?.toLowerCase().includes('registry') || element.label?.toLowerCase().includes('gift')
                      ? `/registry/${eventSlug}`
                      : undefined,
                  }
                : element

              return (
                <FloatingElement
                  key={element.id}
                  element={elementWithLink}
                  onUpdate={() => {}}
                  motionEnabled={motionEnabled}
                  isEditing={false}
                />
              )
            })}
          </CanvasArea>
        </div>
      </div>
    </div>
  )
}

