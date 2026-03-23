'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getWhatsAppTemplates,
  createCampaign,
  updateCampaign,
  previewCampaignRecipients,
  launchCampaign,
  MessageCampaign,
  WhatsAppTemplate,
  CampaignGuestFilter,
  CampaignMessageMode,
} from '@/lib/api'
import { replaceTemplateVariables } from '@/lib/whatsapp'
import { useToast } from '@/components/ui/toast'

interface Props {
  eventId: number
  onClose: () => void
  onCreated: (campaign: MessageCampaign) => void
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'mr', label: 'Marathi' },
  { value: 'kn', label: 'Kannada' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'bn', label: 'Bengali' },
]

const FILTER_OPTIONS: { value: CampaignGuestFilter; label: string }[] = [
  { value: 'all',          label: 'All guests' },
  { value: 'not_sent',     label: 'Not yet invited' },
  { value: 'rsvp_yes',     label: 'RSVP: Yes' },
  { value: 'rsvp_no',      label: 'RSVP: No' },
  { value: 'rsvp_maybe',   label: 'RSVP: Maybe' },
  { value: 'rsvp_pending', label: 'No RSVP yet' },
  { value: 'relationship', label: 'By relationship group' },
]

// Sample data for live preview in the wizard
const SAMPLE_VARS = {
  name: 'Priya',
  event_title: 'Our Wedding',
  event_date: 'April 12, 2026',
  event_location: 'Mumbai',
  event_url: 'https://ekfern.com/invite/sample',
  host_name: 'Aakash & Priya',
  map_direction: 'https://maps.google.com/?q=Mumbai',
}

export default function CampaignWizard({ eventId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const { showToast } = useToast()

  // Step 1 fields
  const [name, setName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('')
  const [messageMode, setMessageMode] = useState<CampaignMessageMode>('approved_template')
  const [messageBody, setMessageBody] = useState('')
  const [metaTemplateName, setMetaTemplateName] = useState('')
  const [metaLanguage, setMetaLanguage] = useState('en')

  // Step 2 fields (campaign is created at end of step 1)
  const [campaign, setCampaign] = useState<MessageCampaign | null>(null)
  const [guestFilter, setGuestFilter] = useState<CampaignGuestFilter>('all')
  const [filterRelationship, setFilterRelationship] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Step 3 fields
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [launching, setLaunching] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getWhatsAppTemplates(eventId).then(setTemplates).catch(() => {})
  }, [eventId])

  const handleTemplateChange = (templateId: number | '') => {
    setSelectedTemplateId(templateId)
    if (templateId) {
      const found = templates.find(t => t.id === templateId)
      if (found) setMessageBody(found.template_text)
    }
  }

  // Live preview of the message body with sample data
  const previewText = messageBody
    ? replaceTemplateVariables(messageBody, SAMPLE_VARS)
    : ''

  const step1Valid =
    name.trim().length > 0 &&
    messageBody.trim().length > 0 &&
    (messageMode === 'freeform' || metaTemplateName.trim().length > 0)

  const handleStep1Next = async () => {
    if (creating) return
    setCreating(true)
    try {
      const created = await createCampaign(eventId, {
        name: name.trim(),
        template: selectedTemplateId || null,
        message_mode: messageMode,
        message_body: messageBody,
        meta_template_name: metaTemplateName,
        meta_template_language: metaLanguage,
        guest_filter: 'all',
        filter_relationship: '',
        custom_guest_ids: [],
        scheduled_at: null,
      })
      setCampaign(created)
      setStep(2)
      fetchPreview(created, 'all')
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? e?.response?.data?.detail ?? 'Failed to create campaign', 'error')
    } finally {
      setCreating(false)
    }
  }

  const fetchPreview = async (c: MessageCampaign, filter: CampaignGuestFilter) => {
    setPreviewLoading(true)
    try {
      const r = await previewCampaignRecipients(eventId, c.id)
      setRecipientCount(r.count)
    } catch {
      setRecipientCount(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleFilterChange = async (filter: CampaignGuestFilter, rel = filterRelationship) => {
    setGuestFilter(filter)
    if (!campaign) return
    try {
      const updated = await updateCampaign(eventId, campaign.id, {
        guest_filter: filter,
        filter_relationship: filter === 'relationship' ? rel : '',
      })
      setCampaign(updated)
      fetchPreview(updated, filter)
    } catch { /* silent — preview count will show null */ }
  }

  const handleStep3Launch = async () => {
    if (!campaign) return
    setLaunching(true)
    try {
      if (scheduleMode === 'later' && scheduledAt) {
        await updateCampaign(eventId, campaign.id, {
          scheduled_at: new Date(scheduledAt).toISOString(),
        })
      }
      const launched = await launchCampaign(eventId, campaign.id)
      showToast(
        scheduleMode === 'now'
          ? 'Campaign launched — messages are being dispatched.'
          : `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
        'success'
      )
      onCreated(launched)
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed to launch campaign', 'error')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white border-2 border-eco-green-light max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {step === 1 && 'New Campaign — Message'}
              {step === 2 && 'New Campaign — Recipients'}
              {step === 3 && 'New Campaign — Schedule & Confirm'}
            </CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {([1, 2, 3] as const).map(s => (
              <div
                key={s}
                className={`flex items-center gap-1.5 text-xs font-medium ${step >= s ? 'text-eco-green' : 'text-gray-300'}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    step >= s ? 'bg-eco-green text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {s}
                </span>
                {s === 1 ? 'Message' : s === 2 ? 'Recipients' : 'Schedule'}
                {s < 3 && (
                  <span className={`w-8 h-px ${step > s ? 'bg-eco-green' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ─── STEP 1 ─── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign name *
                </label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Wedding Invitation — Batch 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Load from template (optional)
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e =>
                    handleTemplateChange(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                >
                  <option value="">— Select a template —</option>
                  {templates.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.message_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message mode
                </label>
                <div className="flex gap-2">
                  {(['approved_template', 'freeform'] as CampaignMessageMode[]).map(mode => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={messageMode === mode ? 'default' : 'outline'}
                      onClick={() => setMessageMode(mode)}
                      className={
                        messageMode === mode
                          ? 'bg-eco-green hover:bg-green-600 text-white'
                          : 'border-eco-green text-eco-green hover:bg-eco-green-light'
                      }
                    >
                      {mode === 'approved_template' ? 'Approved Template' : 'Free-form'}
                    </Button>
                  ))}
                </div>
                {messageMode === 'freeform' && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    Free-form messages only reach guests who have messaged your WhatsApp number in
                    the last 24 hours. Use Approved Template for cold outbound invitations.
                  </p>
                )}
              </div>

              {messageMode === 'approved_template' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meta template name *
                    </label>
                    <Input
                      value={metaTemplateName}
                      onChange={e => setMetaTemplateName(e.target.value)}
                      placeholder="e.g. event_invitation_v1"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      The approved template name from your Meta Business Manager.
                    </p>
                  </div>
                  <div className="w-36">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      value={metaLanguage}
                      onChange={e => setMetaLanguage(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                    >
                      {LANGUAGE_OPTIONS.map(l => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message body *
                </label>
                <textarea
                  value={messageBody}
                  onChange={e => setMessageBody(e.target.value)}
                  rows={5}
                  placeholder="Use [name], [event_title], [event_date], [event_url], [host_name], [event_location]"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Variables: [name] [event_title] [event_date] [event_url] [host_name]{' '}
                  [event_location] [map_direction]
                </p>
              </div>

              {previewText && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Preview (sample guest)</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {previewText}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStep1Next}
                  disabled={!step1Valid || creating}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  {creating ? 'Creating...' : 'Next'}
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 2 ─── */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target guests
                </label>
                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.map(opt => (
                    <Button
                      key={opt.value}
                      size="sm"
                      variant={guestFilter === opt.value ? 'default' : 'outline'}
                      onClick={() => handleFilterChange(opt.value)}
                      className={
                        guestFilter === opt.value
                          ? 'bg-eco-green hover:bg-green-600 text-white'
                          : 'border-eco-green text-eco-green hover:bg-eco-green-light'
                      }
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {guestFilter === 'relationship' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Relationship group
                  </label>
                  <Input
                    value={filterRelationship}
                    onChange={e => {
                      setFilterRelationship(e.target.value)
                      if (campaign) handleFilterChange('relationship', e.target.value)
                    }}
                    placeholder="e.g. Family, Friends, Colleagues"
                  />
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center">
                {previewLoading ? (
                  <p className="text-sm text-gray-400">Counting recipients...</p>
                ) : recipientCount !== null ? (
                  <>
                    <p className="text-3xl font-bold text-eco-green">{recipientCount}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      guests will receive this message
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Unable to count recipients</p>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={guestFilter === 'relationship' && !filterRelationship.trim()}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  Next
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 3 ─── */}
          {step === 3 && campaign && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When to send
                </label>
                <div className="flex gap-2">
                  {(['now', 'later'] as const).map(mode => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={scheduleMode === mode ? 'default' : 'outline'}
                      onClick={() => setScheduleMode(mode)}
                      className={
                        scheduleMode === mode
                          ? 'bg-eco-green hover:bg-green-600 text-white'
                          : 'border-eco-green text-eco-green hover:bg-eco-green-light'
                      }
                    >
                      {mode === 'now' ? 'Send now' : 'Schedule for later'}
                    </Button>
                  ))}
                </div>
                {scheduleMode === 'later' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="mt-3 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                  />
                )}
              </div>

              <div className="bg-eco-green-light border border-eco-green rounded-md p-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Campaign:</span> {campaign.name}
                </p>
                <p>
                  <span className="font-medium">Mode:</span>{' '}
                  {campaign.message_mode === 'approved_template'
                    ? 'Approved Template'
                    : 'Free-form'}
                </p>
                {campaign.message_mode === 'approved_template' && (
                  <p>
                    <span className="font-medium">Meta template:</span>{' '}
                    {campaign.meta_template_name}
                  </p>
                )}
                <p>
                  <span className="font-medium">Recipients:</span>{' '}
                  {recipientCount !== null ? recipientCount : '—'} guests
                </p>
                <p>
                  <span className="font-medium">Send time:</span>{' '}
                  {scheduleMode === 'now'
                    ? 'Immediately after launch'
                    : scheduledAt
                    ? new Date(scheduledAt).toLocaleString()
                    : 'Not set'}
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  onClick={handleStep3Launch}
                  disabled={launching || (scheduleMode === 'later' && !scheduledAt)}
                  className="bg-eco-green hover:bg-green-600 text-white w-48"
                >
                  {launching ? 'Launching...' : 'Launch Campaign'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
