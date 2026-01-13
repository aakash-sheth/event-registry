'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor'
import { getDescriptionVariables } from '@/lib/api'

interface DescriptionEditorModalProps {
  isOpen: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
  eventId?: number
}

export default function DescriptionEditorModal({
  isOpen,
  onClose,
  value,
  onChange,
  placeholder = 'Enter event description...',
  eventId,
}: DescriptionEditorModalProps) {
  const [localValue, setLocalValue] = useState(value)
  const editorRef = useRef<RichTextEditorRef>(null)
  const [availableVariables, setAvailableVariables] = useState<Array<{
    key: string
    label: string
    description: string
    example: string
    is_custom?: boolean
  }>>([])
  const [showVariablesPanel, setShowVariablesPanel] = useState(false)

  // Load variables when modal opens and eventId is available
  useEffect(() => {
    if (isOpen && eventId) {
      getDescriptionVariables(eventId)
        .then(setAvailableVariables)
        .catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to load description variables:', error)
          }
        })
    }
  }, [isOpen, eventId])

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
            {eventId && availableVariables.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVariablesPanel(!showVariablesPanel)}
                className="ml-4 text-xs px-3 py-1 bg-eco-green text-white rounded hover:bg-green-600 transition-colors"
              >
                {showVariablesPanel ? 'Hide' : 'Show'} Variables
              </button>
            )}
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
        <div className="flex-1 overflow-y-auto p-6 flex gap-4">
          {/* Variables Panel */}
          {showVariablesPanel && eventId && availableVariables.length > 0 && (
            <div className="w-64 bg-gray-50 p-4 rounded-md border border-gray-200 overflow-y-auto flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">📝 Available Variables</h3>
              <div className="space-y-2">
                <p className="text-xs text-gray-600 mb-3">
                  Click a variable to insert it at the cursor position. You can then select and style it using the toolbar.
                </p>
                {availableVariables.filter(v => !v.is_custom).map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => {
                      if (editorRef.current) {
                        editorRef.current.insertText(variable.key)
                        editorRef.current.focus()
                      }
                    }}
                    className="w-full text-left bg-white p-2 rounded border border-gray-200 hover:bg-gray-50 hover:border-eco-green transition-colors cursor-pointer"
                    title={`Click to insert ${variable.key} at cursor position`}
                  >
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-eco-green font-mono text-xs">
                      {variable.key}
                    </code>
                    <span className="ml-2 text-sm text-gray-700">{variable.label}</span>
                    <p className="text-xs text-gray-500 mt-1">
                      {variable.description}
                    </p>
                  </button>
                ))}
                {availableVariables.filter(v => v.is_custom).length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-gray-600 mb-2">Custom Fields</h4>
                    <div className="space-y-2">
                      {availableVariables.filter(v => v.is_custom).map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          onClick={() => {
                            if (editorRef.current) {
                              editorRef.current.insertText(variable.key)
                              editorRef.current.focus()
                            }
                          }}
                          className="w-full text-left bg-white p-2 rounded border border-gray-200 hover:bg-gray-50 hover:border-eco-green transition-colors cursor-pointer"
                          title={`Click to insert ${variable.key} at cursor position`}
                        >
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-eco-green font-mono text-xs">
                            {variable.key}
                          </code>
                          <span className="ml-2 text-sm text-gray-700">{variable.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 min-h-full">
            <RichTextEditor
              ref={editorRef}
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

