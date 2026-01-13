'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api, { getWhatsAppTemplates, WhatsAppTemplate, deleteWhatsAppTemplate, archiveWhatsAppTemplate, activateWhatsAppTemplate, setDefaultTemplate, getAvailableVariables, getSystemDefaultTemplate } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { logError } from '@/lib/error-handler'
import TemplateList from '@/components/communications/TemplateList'
import TemplateEditor from '@/components/communications/TemplateEditor'
import Logo from '@/components/Logo'

export default function CommunicationsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = parseInt(params.eventId as string)
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [systemDefaultTemplate, setSystemDefaultTemplate] = useState<WhatsAppTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [event, setEvent] = useState<any>(null)
  const [availableVariables, setAvailableVariables] = useState<Array<{key: string, label: string, description: string, example: string, is_custom?: boolean}>>([])
  const [showVariablesPanel, setShowVariablesPanel] = useState(false)

  useEffect(() => {
    if (!eventId || isNaN(eventId)) {
      showToast('Invalid event ID', 'error')
      router.push('/host/dashboard')
      return
    }
    fetchEvent()
    fetchTemplates()
    fetchAvailableVariables()
  }, [eventId, router])

  const fetchAvailableVariables = async () => {
    try {
      const vars = await getAvailableVariables(eventId)
      setAvailableVariables(vars)
    } catch (error) {
      logError('Failed to fetch available variables:', error)
    }
  }

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
    } catch (error: any) {
      logError('Failed to fetch event:', error)
      showToast('Failed to load event', 'error')
    }
  }

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const data = await getWhatsAppTemplates(eventId)
      setTemplates(data)
      
      // Always fetch system default template
      const systemDefault = await getSystemDefaultTemplate(eventId)
      if (systemDefault) {
        setSystemDefaultTemplate(systemDefault)
      } else {
        // Create a fallback system default template if it doesn't exist
        // This ensures it's always available even if not in database
        const fallbackSystemDefault: WhatsAppTemplate = {
          id: -1, // Use negative ID to indicate it's a fallback
          event: eventId,
          name: 'System Default Invitation',
          message_type: 'invitation',
          template_text: 'Hey [name]! 💛\n\nJust wanted to share [event_title] on [event_date]!\n\nPlease confirm here: [event_url]\n\n- [host_name]',
          description: 'Default template used when no event-specific default is set. This is a global template visible in all events.',
          usage_count: 0,
          is_active: true,
          last_used_at: null,
          is_default: false,
          is_system_default: true,
          created_by: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSystemDefaultTemplate(fallbackSystemDefault)
      }
    } catch (error: any) {
      logError('Failed to fetch templates:', error)
      // Even if fetch fails, create fallback system default
      const fallbackSystemDefault: WhatsAppTemplate = {
        id: -1,
        event: eventId,
        name: 'System Default Invitation',
        message_type: 'invitation',
        template_text: 'Hey [name]! 💛\n\nJust wanted to share [event_title] on [event_date]!\n\nPlease confirm here: [event_url]\n\n- [host_name]',
        description: 'Default template used when no event-specific default is set. This is a global template visible in all events.',
        usage_count: 0,
        is_active: true,
        last_used_at: null,
        is_default: false,
        is_system_default: true,
        created_by: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setSystemDefaultTemplate(fallbackSystemDefault)
      showToast('Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEditTemplate = (template: WhatsAppTemplate) => {
    // System default templates cannot be edited (including fallback with id -1)
    if (template.is_system_default || template.id === -1) {
      showToast('System default templates cannot be edited', 'info')
      return
    }
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleDeleteTemplate = async (template: WhatsAppTemplate) => {
    // System default templates cannot be deleted (including fallback with id -1)
    if (template.is_system_default || template.id === -1) {
      showToast('System default templates cannot be deleted.', 'info')
      return
    }
    
    if (!confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteWhatsAppTemplate(template.id)
      showToast('Template deleted successfully', 'success')
      fetchTemplates()
    } catch (error: any) {
      logError('Failed to delete template:', error)
      showToast(error.response?.data?.error || 'Failed to delete template', 'error')
    }
  }

  const handleArchiveTemplate = async (template: WhatsAppTemplate) => {
    // System default templates cannot be archived (including fallback with id -1)
    if (template.is_system_default || template.id === -1) {
      showToast('System default templates cannot be archived.', 'info')
      return
    }
    try {
      if (template.is_active) {
        await archiveWhatsAppTemplate(template.id)
        showToast('Template archived', 'success')
      } else {
        await activateWhatsAppTemplate(template.id)
        showToast('Template activated', 'success')
      }
      fetchTemplates()
    } catch (error: any) {
      logError('Failed to archive/activate template:', error)
      showToast(error.response?.data?.error || 'Failed to update template', 'error')
    }
  }

  const handleSaveTemplate = () => {
    setShowEditor(false)
    setEditingTemplate(null)
    fetchTemplates()
  }

  const handleCancelEditor = () => {
    setShowEditor(false)
    setEditingTemplate(null)
  }

  const handleSetDefault = async (template: WhatsAppTemplate) => {
    try {
      await setDefaultTemplate(template.id)
      showToast('Template set as default', 'success')
      fetchTemplates()
    } catch (error: any) {
      logError('Failed to set default template:', error)
      showToast(error.response?.data?.error || 'Failed to set default template', 'error')
    }
  }

  const filteredTemplates = (() => {
    // Start with custom templates (event-specific templates)
    let result = templates.filter(template => {
      const matchesType = filterType === 'all' || template.message_type === filterType
      const matchesSearch = searchQuery === '' || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.template_text.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesType && matchesSearch
    })
    
    // Always include system default template (global template visible in all events)
    // Show it if:
    // 1. It exists
    // 2. Filter is "all" or matches the template's message type
    // 3. It matches the search query (if any)
    // 4. It's not already in the list (in case it was created for this event)
    if (systemDefaultTemplate) {
      const matchesType = filterType === 'all' || systemDefaultTemplate.message_type === filterType
      const matchesSearch = searchQuery === '' || 
        systemDefaultTemplate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        systemDefaultTemplate.template_text.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Add system default template at the top if it matches filters and isn't already in the list
      // Check both ID match and is_system_default flag to prevent duplicates
      const isDuplicate = result.some(t => 
        t.id === systemDefaultTemplate.id || 
        (t.is_system_default && systemDefaultTemplate.is_system_default)
      )
      if (matchesType && matchesSearch && !isDuplicate) {
        result = [systemDefaultTemplate, ...result]
      }
    }
    
    return result
  })()

  const messageTypeLabels: Record<string, string> = {
    all: 'All Templates',
    invitation: 'Invitations',
    reminder: 'Reminders',
    update: 'Updates',
    venue_change: 'Venue Changes',
    time_change: 'Time Changes',
    thank_you: 'Thank You',
    custom: 'Custom',
  }

  if (loading && templates.length === 0) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      {/* Header */}
      <nav className="bg-white border-b border-eco-green-light shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo href="/" />
          <div className="flex items-center gap-4">
            <Link href={`/host/events/${eventId}/guests`}>
              <Button variant="outline" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                Manage Guests
              </Button>
            </Link>
            <Link href={`/host/events/${eventId}`}>
              <Button variant="ghost" className="text-eco-green">
                ← Back to Event
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-eco-green">WhatsApp Templates</h1>
          <p className="text-gray-600">
            {event && `Manage message templates for ${event.title}`}
          </p>
        </div>

        {/* Filters and Actions */}
        <Card className="bg-white border-2 border-eco-green-light mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {Object.entries(messageTypeLabels).map(([value, label]) => (
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
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowVariablesPanel(!showVariablesPanel)}
                    variant="outline"
                    className="border-eco-green text-eco-green hover:bg-eco-green-light flex-1 sm:flex-none"
                  >
                    {showVariablesPanel ? 'Hide' : 'Show'} Variables
                  </Button>
                  <Button
                    onClick={handleCreateTemplate}
                    className="bg-eco-green hover:bg-green-600 text-white flex-1 sm:flex-none whitespace-nowrap"
                  >
                    + Create Template
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Variables Panel */}
        {showVariablesPanel && (
          <Card className="bg-white border-2 border-eco-green-light mb-6">
            <CardHeader>
              <CardTitle className="text-eco-green">Available Variables</CardTitle>
            </CardHeader>
            <CardContent>
              {availableVariables.length === 0 ? (
                <p className="text-gray-500">Loading variables...</p>
              ) : (
                <div className="space-y-4">
                  {/* Default Variables */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Default Variables</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availableVariables.filter(v => !v.is_custom).map((variable) => (
                        <div key={variable.key} className="bg-gray-50 p-2 rounded text-sm">
                          <code className="bg-white px-1 py-0.5 rounded text-eco-green font-mono">{variable.key}</code>
                          <span className="ml-2 text-gray-700">{variable.label}</span>
                          {variable.description && (
                            <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom Variables */}
                  {availableVariables.filter(v => v.is_custom).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Custom Variables (from CSV)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {availableVariables.filter(v => v.is_custom).map((variable) => (
                          <div key={variable.key} className="bg-blue-50 p-2 rounded text-sm">
                            <code className="bg-white px-1 py-0.5 rounded text-blue-600 font-mono">{variable.key}</code>
                            <span className="ml-2 text-gray-700">{variable.label}</span>
                            {variable.example && variable.example !== '—' && (
                              <p className="text-xs text-gray-500 mt-1">Example: {variable.example}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Template Editor Modal */}
        {showEditor && (
          <TemplateEditor
            eventId={eventId}
            template={editingTemplate}
            onSave={handleSaveTemplate}
            onCancel={handleCancelEditor}
          />
        )}

        {/* Template List */}
        {filteredTemplates.length === 0 ? (
          <Card className="bg-white border-2 border-eco-green-light">
            <CardContent className="text-center py-16">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2 text-eco-green">No templates found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : filterType === 'invitation'
                  ? 'No custom invitation templates found. The system default invitation template is always available when filtering by "All Templates".'
                  : filterType !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first WhatsApp template to start sending personalized messages'}
              </p>
              {!searchQuery && filterType === 'all' && (
                <Button
                  onClick={handleCreateTemplate}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  Create Your First Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <TemplateList
            templates={filteredTemplates}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
            onArchive={handleArchiveTemplate}
            onSetDefault={handleSetDefault}
          />
        )}
      </div>
    </div>
  )
}

