'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import api, { getWhatsAppTemplates, WhatsAppTemplate, deleteWhatsAppTemplate, archiveWhatsAppTemplate, activateWhatsAppTemplate, setDefaultTemplate, getAvailableVariables, getSystemDefaultTemplate, MessageCampaign, incrementWhatsAppTemplateUsage, getWhatsAppStatus, checkWaitlist, joinWaitlist } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { logError } from '@/lib/error-handler'
import { generateWhatsAppLink, openWhatsApp, replaceTemplateVariables } from '@/lib/whatsapp'
import { getSiteUrl } from '@/lib/site-url'
import TemplateList from '@/components/communications/TemplateList'
import TemplateEditor from '@/components/communications/TemplateEditor'
import GuestPicker, { PickableGuest } from '@/components/communications/GuestPicker'
import CampaignList from '@/components/communications/CampaignList'
import CampaignWizard from '@/components/communications/CampaignWizard'
import CampaignReport from '@/components/communications/CampaignReport'
import TemplateSelector from '@/components/communications/TemplateSelector'

type TabKey = 'send' | 'outbox' | 'reports' | 'templates'
const VALID_TABS: TabKey[] = ['send', 'outbox', 'reports', 'templates']

export default function CommunicationsPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const eventId = parseInt(params.eventId as string)
  const { showToast } = useToast()

  const tabFromUrl = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'send'
  )

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab)
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', tab)
    router.replace(`${pathname}?${p.toString()}`)
  }

  // Campaign modal state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardChannel, setWizardChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [reportCampaign, setReportCampaign] = useState<MessageCampaign | null>(null)
  const [editingCampaign, setEditingCampaign] = useState<MessageCampaign | null>(null)
  const [campaignListKey, setCampaignListKey] = useState(0)

  const openWizard = (channel: 'whatsapp' | 'email') => {
    setWizardChannel(channel)
    setShowWizard(true)
  }

  const [whatsappReady, setWhatsappReady] = useState(false)
  const [bulkWhatsappWaitlisted, setBulkWhatsappWaitlisted] = useState(false)
  useEffect(() => {
    getWhatsAppStatus().then(s => setWhatsappReady(s.configured && s.enabled)).catch(() => {})
    checkWaitlist('bulk_whatsapp').then(setBulkWhatsappWaitlisted).catch(() => {})
  }, [])

  // 1-on-1 manual send state
  const [showGuestPicker, setShowGuestPicker] = useState(false)
  const [selectedGuestForMessage, setSelectedGuestForMessage] = useState<PickableGuest | null>(null)

  // Template state (unchanged)
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

  const handleGuestSelected = (guest: PickableGuest) => {
    setSelectedGuestForMessage(guest)
    setShowGuestPicker(false)
  }

  const handleManualTemplateSelected = async (template: WhatsAppTemplate | null) => {
    if (!event || !selectedGuestForMessage) return
    const guest = selectedGuestForMessage
    setSelectedGuestForMessage(null)

    try {
      const guestParam = guest.guest_token ? `&g=${guest.guest_token}` : ''
      const eventUrl = `${getSiteUrl()}/invite/${event.slug || eventId}?source=link${guestParam}`

      let message: string
      if (template) {
        let mapDirection: string | undefined
        if (event.city) {
          mapDirection = `https://maps.google.com/?q=${encodeURIComponent(event.city)}`
        }
        message = replaceTemplateVariables(template.template_text, {
          name: guest.name,
          event_title: event.title || 'Event',
          event_date: event.date,
          event_location: event.city || '',
          event_url: eventUrl,
          host_name: event.host_name || undefined,
          map_direction: mapDirection,
          custom_fields: guest.custom_fields || {},
        })
        try {
          await incrementWhatsAppTemplateUsage(template.id)
        } catch (err) {
          logError('Failed to increment template usage:', err)
        }
      } else {
        message = `Hey ${guest.name}! You're invited to ${event.title}. ${eventUrl}`
      }

      openWhatsApp(generateWhatsAppLink(guest.phone, message))
      showToast(`Opening WhatsApp for ${guest.name}...`, 'success')

      await api.patch(`/api/events/${eventId}/guests/${guest.id}/`, {
        invitation_sent: true,
        invitation_sent_at: new Date().toISOString(),
      })
    } catch (err) {
      logError('Failed to send manual message:', err)
      showToast('Something went wrong. Please try again.', 'error')
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
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/host/events/${eventId}`}>
                <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                  Back to Event
                </Button>
              </Link>
              <Link href={`/host/events/${eventId}/guests`}>
                <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                  Manage Guests
                </Button>
              </Link>
            </div>
            {activeTab === 'templates' && (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  onClick={() => setShowVariablesPanel(!showVariablesPanel)}
                  variant="outline"
                  size="sm"
                  className="border-eco-green text-eco-green hover:bg-eco-green-light"
                >
                  {showVariablesPanel ? 'Hide' : 'Show'} Variables
                </Button>
                <Button
                  onClick={handleCreateTemplate}
                  size="sm"
                  className="bg-eco-green hover:bg-green-600 text-white whitespace-nowrap"
                >
                  + Create Template
                </Button>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2 text-eco-green">Messages</h1>
            <p className="text-gray-600">
              {event && `Send messages and manage templates for ${event.title}`}
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'send', label: 'Send' },
            { key: 'outbox', label: 'Outbox' },
            { key: 'reports', label: 'Reports' },
            { key: 'templates', label: 'Templates' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={
                activeTab === key
                  ? 'px-4 py-1.5 rounded-md text-sm font-medium bg-eco-green text-white'
                  : 'px-4 py-1.5 rounded-md text-sm font-medium border border-eco-green text-eco-green hover:bg-eco-green-light'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── TEMPLATES TAB ─── */}
        {activeTab === 'templates' && (
          <>
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
          </>
        )}

        {/* ─── SEND MESSAGE TAB ─── */}
        {activeTab === 'send' && (
          <div className="max-w-4xl">
            <p className="text-sm text-gray-500 mb-8">Choose how you want to message your guests.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">

              {/* ── Card 1: One Guest at a Time ── */}
              <div
                className="flex flex-col bg-white border border-gray-200 rounded-2xl p-6 cursor-pointer hover:border-eco-green hover:shadow-sm transition-all"
                onClick={() => setShowGuestPicker(true)}
              >
                <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-4">
                  👤 Personal • Free
                </p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">One Guest at a Time</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  Send messages personally from your WhatsApp.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Best for small groups (1–30 guests)</li>
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Full control before sending</li>
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>No setup needed</li>
                </ul>
              </div>

              {/* ── Card 2: Bulk WhatsApp (primary / highlighted) ── */}
              <div
                className={`flex flex-col rounded-2xl p-6 border-2 transition-all relative ${
                  whatsappReady
                    ? 'bg-white border-eco-green cursor-pointer hover:shadow-md'
                    : 'bg-white border-eco-green cursor-default'
                }`}
                onClick={whatsappReady ? () => openWizard('whatsapp') : undefined}
              >
                <p className="text-xs font-semibold text-amber-600 tracking-wide uppercase mb-4">
                  ⚡ Automated • Paid
                </p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk WhatsApp</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  Send to all guests instantly with one click.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Built for large events (50+ guests)</li>
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Delivery &amp; read tracking</li>
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Verified business messaging</li>
                </ul>
                {!whatsappReady && (
                  <div className="mt-auto">
                    <p className="text-xs text-gray-400 mb-3">Coming soon</p>
                    {bulkWhatsappWaitlisted ? (
                      <p className="text-sm font-medium text-eco-green">
                        ✓ You're on the list
                      </p>
                    ) : (
                      <button
                        className="w-full py-2 rounded-lg bg-eco-green text-white text-sm font-semibold hover:bg-green-600 transition-colors"
                        onClick={async e => {
                          e.stopPropagation()
                          try {
                            await joinWaitlist('bulk_whatsapp', eventId)
                            setBulkWhatsappWaitlisted(true)
                            showToast("You're on the list! We'll notify you when Bulk WhatsApp is ready.", 'success')
                          } catch {
                            showToast("Couldn't save your interest. Please try again.", 'error')
                          }
                        }}
                      >
                        Join waitlist for early access
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Card 3: Bulk Email ── */}
              <div
                className="flex flex-col bg-white border border-gray-200 rounded-2xl p-6 cursor-pointer hover:border-eco-green hover:shadow-sm transition-all"
                onClick={() => openWizard('email')}
              >
                <p className="text-xs font-semibold text-blue-500 tracking-wide uppercase mb-4">
                  📧 Email • Free
                </p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk Email</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  Reach all guests via email.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Best for formal invites</li>
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Works without WhatsApp</li>
                  <li className="flex items-start gap-2"><span className="text-eco-green font-bold mt-0.5">✔</span>Schedule and track delivery</li>
                </ul>
              </div>

            </div>
          </div>
        )}

        {/* ─── OUTBOX + REPORTS (single instance, mode-filtered) ─── */}
        {(activeTab === 'outbox' || activeTab === 'reports') && (
          <>
            <CampaignList
              eventId={eventId}
              mode={activeTab}
              refreshKey={campaignListKey}
              onNewCampaign={() => setShowWizard(true)}
              onViewReport={(c) => setReportCampaign(c)}
              onEdit={(c) => {
                setEditingCampaign(c)
                setShowWizard(true)
              }}
            />
            {activeTab === 'reports' && reportCampaign && (
              <CampaignReport
                eventId={eventId}
                campaign={reportCampaign}
                onClose={() => setReportCampaign(null)}
              />
            )}
          </>
        )}
      </div>

      {/* ─── CAMPAIGN WIZARD MODAL ─── */}
      {showWizard && (
        <CampaignWizard
          eventId={eventId}
          channel={wizardChannel}
          onClose={() => {
            setShowWizard(false)
            setEditingCampaign(null)
          }}
          onCreated={() => {
            setShowWizard(false)
            setEditingCampaign(null)
            setCampaignListKey(k => k + 1)
            switchTab('outbox')
          }}
        />
      )}

      {/* ─── GUEST PICKER MODAL (1-on-1 flow) ─── */}
      {showGuestPicker && (
        <GuestPicker
          eventId={eventId}
          onSelect={handleGuestSelected}
          onCancel={() => setShowGuestPicker(false)}
        />
      )}

      {/* ─── TEMPLATE SELECTOR (after guest picked) ─── */}
      {selectedGuestForMessage !== null && event && (() => {
        const g = selectedGuestForMessage
        return (
          <TemplateSelector
            eventId={eventId}
            eventTitle={event.title}
            eventDate={event.date}
            eventUrl={`${getSiteUrl()}/invite/${event.slug || eventId}?source=link`}
            hostName={event.host_name || undefined}
            eventLocation={event.city || ''}
            guestName={g.name}
            guestId={g.id}
            guestCustomFields={g.custom_fields || {}}
            onSelect={handleManualTemplateSelected}
            onCancel={() => setSelectedGuestForMessage(null)}
          />
        )
      })()}
    </div>
  )
}

