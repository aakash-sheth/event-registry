'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Maximize2 } from 'lucide-react'
import type { DescriptionTileSettings } from '@/lib/invite/schema'
import RichTextEditor, { type RichTextEditorRef } from '@/components/invite/RichTextEditor'
import DescriptionEditorModal from '@/components/invite/DescriptionEditorModal'
import { Button } from '@/components/ui/button'
import { getDescriptionVariables } from '@/lib/api'

interface DescriptionTileSettingsProps {
  settings: DescriptionTileSettings
  onChange: (settings: DescriptionTileSettings) => void
  eventId: number
}

export default function DescriptionTileSettings({ settings, onChange, eventId }: DescriptionTileSettingsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const editorRef = useRef<RichTextEditorRef>(null)
  const [availableVariables, setAvailableVariables] = useState<Array<{
    key: string
    label: string
    description: string
    example: string
    is_custom?: boolean
  }>>([])

  useEffect(() => {
    if (eventId) {
      getDescriptionVariables(eventId)
        .then(setAvailableVariables)
        .catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to load description variables:', error)
          }
        })
    }
  }, [eventId])

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Description</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs border-eco-green text-eco-green hover:bg-eco-green hover:text-white"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Full Screen Editor
          </Button>
        </div>
        <RichTextEditor
          ref={editorRef}
          value={settings.content || ''}
          onChange={(value) => onChange({ ...settings, content: value })}
          placeholder="Enter event description..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Use the toolbar to format text and add links. Click "Full Screen Editor" for a larger editing area.
        </p>
      </div>

      {/* Available Variables Panel */}
      <details className="bg-gray-50 p-3 rounded-md border border-gray-200">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
          📝 Available Variables (click to expand)
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-600 mb-2">
            Use these variables to personalize the description for each guest.{' '}
            {!showMoreInfo ? (
              <button
                type="button"
                onClick={() => setShowMoreInfo(true)}
                className="text-eco-green hover:underline font-medium"
              >
                (more)
              </button>
            ) : (
              <>
                <span className="block mt-1">
                  Variables will be replaced when guests access the invite page using their guest-specific link (with token). On public links without a token, [name] will be replaced with an empty string.
                </span>
                <button
                  type="button"
                  onClick={() => setShowMoreInfo(false)}
                  className="text-eco-green hover:underline font-medium mt-1"
                >
                  (less)
                </button>
              </>
            )}
          </p>
          
          {availableVariables.length === 0 ? (
            <p className="text-xs text-gray-500">Loading variables...</p>
          ) : (
            <>
              {/* Guest Name */}
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
              
              {/* Custom Variables */}
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
            </>
          )}
        </div>
      </details>

      {/* Full Screen Editor Modal */}
      <DescriptionEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        value={settings.content || ''}
        onChange={(value) => onChange({ ...settings, content: value })}
        placeholder="Enter event description..."
        eventId={eventId}
      />
    </div>
  )
}

