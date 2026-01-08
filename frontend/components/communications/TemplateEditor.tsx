'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createWhatsAppTemplate, updateWhatsAppTemplate, WhatsAppTemplate, previewWhatsAppTemplate, getAvailableVariables, previewTemplateWithGuest, getWhatsAppTemplates } from '@/lib/api'
import { logError } from '@/lib/error-handler'
import api from '@/lib/api'

interface TemplateEditorProps {
  eventId: number
  template?: WhatsAppTemplate | null
  onSave: () => void
  onCancel: () => void
}

// Will be loaded from API

const MESSAGE_TYPES = [
  { value: 'invitation', label: 'Initial Invitation' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'update', label: 'Event Update' },
  { value: 'venue_change', label: 'Venue Change' },
  { value: 'time_change', label: 'Time Change' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'custom', label: 'Custom Message' },
]

export default function TemplateEditor({ eventId, template, onSave, onCancel }: TemplateEditorProps) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [messageType, setMessageType] = useState('custom')
  const [templateText, setTemplateText] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [availableVariables, setAvailableVariables] = useState<Array<{key: string, label: string, description: string, example: string, is_custom?: boolean}>>([])
  const [guests, setGuests] = useState<Array<{id: number, name: string}>>([])
  const [selectedGuestId, setSelectedGuestId] = useState<number | null>(null)
  const [previewWarnings, setPreviewWarnings] = useState<{unresolved_variables: string[], missing_custom_fields: string[]} | null>(null)

  useEffect(() => {
    if (template) {
      setName(template.name)
      setMessageType(template.message_type)
      setTemplateText(template.template_text)
      setDescription(template.description || '')
      setIsDefault(template.is_default || false)
    } else {
      setName('')
      setMessageType('custom')
      setTemplateText('')
      setDescription('')
      setIsDefault(false)
    }
  }, [template])

  useEffect(() => {
    // Load available variables
    getAvailableVariables(eventId).then(setAvailableVariables).catch(logError)
    
    // Load guests for testing
    api.get(`/api/events/${eventId}/guests/`).then(response => {
      const guestsData = Array.isArray(response.data) ? response.data : (response.data?.guests || [])
      setGuests(guestsData.filter((g: any) => !g.is_removed).map((g: any) => ({ id: g.id, name: g.name })))
    }).catch(logError)
  }, [eventId])

  useEffect(() => {
    if (templateText) {
      generatePreview()
    } else {
      setPreview('')
      setPreviewWarnings(null)
    }
  }, [templateText, template, selectedGuestId])

  const generatePreview = async () => {
    if (!templateText.trim()) {
      setPreview('')
      setPreviewWarnings(null)
      return
    }

    setLoadingPreview(true)
    try {
      if (template?.id && selectedGuestId) {
        // Preview with specific guest
        const result = await previewTemplateWithGuest(template.id, selectedGuestId)
        setPreview(result.preview)
        setPreviewWarnings(result.warnings)
      } else if (template?.id) {
        // Preview with sample data
        const result = await previewWhatsAppTemplate(template.id, {
          name: 'Sarah',
          event_title: 'John & Jane\'s Wedding',
          event_date: 'March 15, 2024',
          event_url: 'https://example.com/invite/wedding',
          host_name: 'John & Jane',
          event_location: 'Mumbai, India',
        })
        setPreview(result.preview)
        setPreviewWarnings(null)
      } else {
        // New template - use simple replacement
        const result = replaceVariables(templateText)
        setPreview(result.message)
        setPreviewWarnings(result.warnings)
      }
    } catch (error) {
      // Fallback to simple replacement
      const result = replaceVariables(templateText)
      setPreview(result.message)
      setPreviewWarnings(result.warnings)
    } finally {
      setLoadingPreview(false)
    }
  }

  const replaceVariables = (text: string): {message: string, warnings: {unresolved_variables: string[], missing_custom_fields: string[]}} => {
    const { replaceTemplateVariables } = require('@/lib/whatsapp')
    return replaceTemplateVariables(text, {
      name: 'Sarah',
      event_title: 'John & Jane\'s Wedding',
      event_date: 'March 15, 2024',
      event_url: 'https://example.com/invite/wedding',
      host_name: 'John & Jane',
      event_location: 'Mumbai, India',
    })
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-text') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = templateText
      const newText = text.substring(0, start) + variable + text.substring(end)
      setTemplateText(newText)
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    } else {
      setTemplateText(templateText + variable)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Template name is required', 'error')
      return
    }
    if (!templateText.trim()) {
      showToast('Template text is required', 'error')
      return
    }
    if (templateText.length > 4096) {
      showToast('Template text cannot exceed 4096 characters (WhatsApp limit)', 'error')
      return
    }

    setSaving(true)
    try {
      // Check if this is a new template (no id, id is 0, or id is negative)
      // Negative IDs are used for fallback system templates that haven't been saved yet
      const isNewTemplate = !template || !template.id || template.id <= 0
      
      if (isNewTemplate) {
        await createWhatsAppTemplate(eventId, {
          name: name.trim(),
          message_type: messageType,
          template_text: templateText.trim(),
          description: description.trim() || undefined,
          is_default: isDefault,
        })
        showToast('Template created successfully', 'success')
      } else {
        await updateWhatsAppTemplate(template.id, {
          name: name.trim(),
          message_type: messageType,
          template_text: templateText.trim(),
          description: description.trim() || undefined,
          is_default: isDefault,
        })
        showToast('Template updated successfully', 'success')
      }
      onSave()
    } catch (error: any) {
      logError('Failed to save template:', error)
      showToast(error.response?.data?.error || error.response?.data?.name?.[0] || 'Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white border-2 border-eco-green-light max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-eco-green">
            {template ? 'Edit Template' : 'Create New Template'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Initial Invitation, Venue Change Update"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
            />
          </div>

          {/* Message Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Type
            </label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
            >
              {MESSAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Template Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Content *
            </label>
            <textarea
              id="template-text"
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="Hey [name]! 💛&#10;&#10;Just wanted to share [event_title] on [event_date]!&#10;&#10;Please confirm here: [event_url]&#10;&#10;- [host_name]"
              className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[200px] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                Characters: {templateText.length} / 4096
              </p>
              <p className="text-xs text-gray-500">
                {templateText.length > 4096 && (
                  <span className="text-red-500">Exceeds WhatsApp limit!</span>
                )}
              </p>
            </div>
          </div>

          {/* Variable Picker */}
          {availableVariables.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Insert Variables
              </label>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.key)}
                    className={`border-eco-green text-eco-green hover:bg-eco-green-light ${variable.is_custom ? 'border-blue-500 text-blue-600' : ''}`}
                  >
                    {variable.key}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Click a variable to insert it at the cursor position
              </p>
            </div>
          )}

          {/* Set as Default */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={template?.is_system_default}
              className="form-checkbox text-eco-green"
            />
            <label htmlFor="is-default" className="text-sm font-medium text-gray-700">
              Set as Default Template
            </label>
            {template?.is_system_default && (
              <span className="text-xs text-gray-500">(System default cannot be changed)</span>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Send this 1 week before the event"
              className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[80px] focus:outline-none focus:ring-2 focus:ring-eco-green"
            />
          </div>

          {/* Available Variables Panel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Variables
            </label>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[200px] overflow-y-auto">
              {availableVariables.length === 0 ? (
                <p className="text-sm text-gray-500">Loading variables...</p>
              ) : (
                <div className="space-y-3">
                  {/* Default Variables */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase">Default Variables</h4>
                    <div className="space-y-1">
                      {availableVariables.filter(v => !v.is_custom).map((variable) => (
                        <div key={variable.key} className="text-xs">
                          <code className="bg-white px-1 py-0.5 rounded text-eco-green font-mono">{variable.key}</code>
                          <span className="ml-2 text-gray-600">{variable.label}</span>
                          {variable.description && (
                            <span className="ml-2 text-gray-500">- {variable.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom Variables */}
                  {availableVariables.filter(v => v.is_custom).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase">Custom Variables (from CSV)</h4>
                      <div className="space-y-1">
                        {availableVariables.filter(v => v.is_custom).map((variable) => (
                          <div key={variable.key} className="text-xs">
                            <code className="bg-white px-1 py-0.5 rounded text-blue-600 font-mono">{variable.key}</code>
                            <span className="ml-2 text-gray-600">{variable.label}</span>
                            {variable.example && variable.example !== '—' && (
                              <span className="ml-2 text-gray-500">(e.g., {variable.example})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Test with Guest */}
          {guests.length > 0 && template?.id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test with Guest
              </label>
              <select
                value={selectedGuestId || ''}
                onChange={(e) => setSelectedGuestId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
              >
                <option value="">Use sample data</option>
                {guests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preview
              </label>
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 min-h-[100px] whitespace-pre-wrap">
                {loadingPreview ? (
                  <div className="text-gray-400">Generating preview...</div>
                ) : (
                  <div>
                    {previewWarnings && previewWarnings.unresolved_variables.length > 0 && (
                      <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        <strong>Warning:</strong> Unresolved variables: {previewWarnings.unresolved_variables.join(', ')}
                      </div>
                    )}
                    {previewWarnings && previewWarnings.missing_custom_fields.length > 0 && (
                      <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                        <strong>Note:</strong> Missing custom fields (shown as —): {previewWarnings.missing_custom_fields.join(', ')}
                      </div>
                    )}
                    <div className={previewWarnings && previewWarnings.unresolved_variables.length > 0 ? 'opacity-75' : ''}>
                      {preview.split('\n').map((line, idx) => {
                        // Highlight unresolved variables
                        if (previewWarnings && previewWarnings.unresolved_variables.length > 0) {
                          let highlightedLine = line
                          previewWarnings.unresolved_variables.forEach(variable => {
                            highlightedLine = highlightedLine.replace(
                              new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                              `<span class="bg-yellow-200 px-1 rounded">${variable}</span>`
                            )
                          })
                          return <div key={idx} dangerouslySetInnerHTML={{ __html: highlightedLine }} />
                        }
                        return <div key={idx}>{line}</div>
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              onClick={onCancel}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || !templateText.trim()}
              className="bg-eco-green hover:bg-green-600 text-white"
            >
              {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

