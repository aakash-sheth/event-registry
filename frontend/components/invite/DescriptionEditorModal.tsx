'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RichTextEditor from './RichTextEditor'

interface DescriptionEditorModalProps {
  isOpen: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function DescriptionEditorModal({
  isOpen,
  onClose,
  value,
  onChange,
  placeholder = 'Enter event description...',
}: DescriptionEditorModalProps) {
  const [localValue, setLocalValue] = useState(value)

  // Sync local value with prop value when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value)
    }
  }, [isOpen, value])

  const handleCancel = useCallback(() => {
    setLocalValue(value) // Reset to original value
    onClose()
  }, [value, onClose])

  const handleSave = () => {
    onChange(localValue)
    onClose()
  }

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleCancel])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          handleCancel()
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5 text-eco-green" />
            <h2 className="text-lg font-semibold text-eco-green">Full Screen Editor</h2>
            <span className="text-xs text-gray-500 ml-2">Edit your description with more space</span>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Editor Content - Takes most of the space */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="min-h-full">
            <RichTextEditor
              value={localValue}
              onChange={setLocalValue}
              placeholder={placeholder}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-500">
            Tip: Use the toolbar above to format your text. Changes are saved when you click "Save Changes".
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-eco-green hover:bg-green-600 text-white"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

