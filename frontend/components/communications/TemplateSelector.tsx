'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getWhatsAppTemplates, WhatsAppTemplate, getSystemDefaultTemplate } from '@/lib/api'
import { logError } from '@/lib/error-handler'
import { replaceTemplateVariables } from '@/lib/whatsapp'

interface TemplateSelectorProps {
  eventId: number
  eventTitle?: string
  eventDate?: string | null
  eventUrl?: string
  hostName?: string
  eventLocation?: string
  guestName?: string
  guestId?: number
  guestCustomFields?: Record<string, string>
  defaultMessageType?: string
  onSelect: (template: WhatsAppTemplate | null) => void
  onCancel: () => void
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  invitation: '📧 Invitations',
  reminder: '⏰ Reminders',
  update: '📢 Updates',
  venue_change: '📍 Venue Changes',
  time_change: '🕐 Time Changes',
  thank_you: '🙏 Thank You',
  custom: '💬 Custom',
}

export default function TemplateSelector({
  eventId,
  eventTitle = 'Event',
  eventDate,
  eventUrl = '',
  hostName,
  eventLocation,
  guestName,
  guestId,
  guestCustomFields,
  defaultMessageType,
  onSelect,
  onCancel,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [systemDefault, setSystemDefault] = useState<WhatsAppTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null)
  const [preview, setPreview] = useState('')
  const [filterType, setFilterType] = useState<string>(defaultMessageType || 'all')

  useEffect(() => {
    fetchTemplates()
  }, [eventId])

  useEffect(() => {
    if (selectedTemplate) {
      generatePreview(selectedTemplate)
    } else {
      setPreview('')
    }
  }, [selectedTemplate, eventTitle, eventDate, eventUrl, hostName, eventLocation, guestName])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const data = await getWhatsAppTemplates(eventId)
      // Filter to only active templates
      const activeTemplates = data.filter(t => t.is_active)
      setTemplates(activeTemplates)
      
      // Load system default template
      const sysDefault = await getSystemDefaultTemplate(eventId)
      setSystemDefault(sysDefault)
      
      // Auto-select default template: event default → system default
      const eventDefault = activeTemplates.find(t => t.is_default)
      if (eventDefault) {
        setSelectedTemplate(eventDefault)
      } else if (sysDefault) {
        setSelectedTemplate(sysDefault)
      }
    } catch (error) {
      logError('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const generatePreview = (template: WhatsAppTemplate) => {
    const dateStr = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'TBD'

    let mapDirection: string | undefined
    if (eventLocation) {
      const encodedLocation = encodeURIComponent(eventLocation)
      mapDirection = `https://maps.google.com/?q=${encodedLocation}`
    }

    const result = replaceTemplateVariables(template.template_text, {
      name: guestName || 'Guest',
      event_title: eventTitle,
      event_date: eventDate,
      event_location: eventLocation || '',
      event_url: eventUrl,
      host_name: hostName || 'Host',
      map_direction: mapDirection,
      custom_fields: guestCustomFields || {},
    })

    setPreview(result.message)
  }

  const filteredTemplates = templates.filter(template => {
    return filterType === 'all' || template.message_type === filterType
  })

  const handleSelect = () => {
    onSelect(selectedTemplate)
  }

  const handleUseDefault = () => {
    // Find event default or system default
    const eventDefault = templates.find(t => t.is_default)
    if (eventDefault) {
      onSelect(eventDefault)
    } else if (systemDefault) {
      onSelect(systemDefault)
    } else {
      onSelect(null) // Fallback to event's whatsapp_message_template
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white border-2 border-eco-green-light max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-eco-green">Select WhatsApp Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterType('all')}
              className={
                filterType === 'all'
                  ? 'bg-eco-green hover:bg-green-600 text-white'
                  : 'border-eco-green text-eco-green hover:bg-eco-green-light'
              }
              size="sm"
            >
              All
            </Button>
            {Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => (
              <Button
                key={value}
                variant={filterType === value ? 'default' : 'outline'}
                onClick={() => setFilterType(value)}
                className={
                  filterType === value
                    ? 'bg-eco-green hover:bg-green-600 text-white'
                    : 'border-eco-green text-eco-green hover:bg-eco-green-light'
                }
                size="sm"
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Template List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No templates found. Create one in the Communications page.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-3 border-2 rounded cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'border-eco-green bg-eco-green-light'
                      : 'border-gray-200 hover:border-eco-green-light'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-eco-green">{template.name}</div>
                        {template.is_default && (
                          <span className="px-2 py-0.5 bg-eco-green text-white text-xs rounded font-semibold">
                            Default
                          </span>
                        )}
                        {template.is_system_default && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-semibold">
                            System Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {MESSAGE_TYPE_LABELS[template.message_type] || 'Custom'} • Used {template.usage_count} times
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <span className="text-eco-green">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {selectedTemplate && preview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preview
              </label>
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 whitespace-pre-wrap text-sm">
                {preview}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              onClick={onCancel}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUseDefault}
              variant="outline"
              className="border-eco-green text-eco-green hover:bg-eco-green-light"
            >
              {templates.find(t => t.is_default) ? 'Use Event Default' : systemDefault ? 'Use System Default' : 'Use Default'}
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!selectedTemplate}
              className="bg-eco-green hover:bg-green-600 text-white"
            >
              Use Template
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

