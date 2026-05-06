'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  createCampaign,
  updateCampaign,
  previewCampaignRecipients,
  launchCampaign,
  getMetaApprovedTemplates,
  getGuestSegments,
  resolveGuestSegment,
  updateGuestSegment,
  deleteGuestSegment,
  MessageCampaign,
  MetaApprovedTemplate,
  CampaignGuestFilter,
  GuestSegment,
  CampaignRecipientPreview,
} from '@/lib/api'
import { useToast } from '@/components/ui/toast'

interface Props {
  eventId: number
  channel: 'whatsapp' | 'email'
  onClose: () => void
  onCreated: (campaign: MessageCampaign) => void
}

const FILTER_OPTIONS: { value: CampaignGuestFilter; label: string; description: string }[] = [
  { value: 'all',          label: 'All guests',      description: 'Everyone on your guest list' },
  { value: 'not_sent',     label: 'Not yet invited', description: "Guests who haven't received a message yet" },
  { value: 'rsvp_pending', label: 'No RSVP yet',     description: "Guests who haven't responded" },
  { value: 'rsvp_yes',     label: 'Coming',          description: 'Guests who confirmed attendance' },
  { value: 'rsvp_no',      label: 'Not coming',      description: 'Guests who declined' },
]

const STEP_TITLES = ['What do you want to say?', 'Who should receive it?', 'When to send?', 'Review & Send']

export default function CampaignWizard({ eventId, channel, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [metaTemplates, setMetaTemplates] = useState<MetaApprovedTemplate[]>([])
  const { showToast } = useToast()

  // Step 1 — WhatsApp fields
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<MetaApprovedTemplate | null>(null)

  // Step 1 — Email fields
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  // Step 2 fields
  const [campaign, setCampaign] = useState<MessageCampaign | null>(null)
  const [guestFilter, setGuestFilter] = useState<CampaignGuestFilter>('all')
  const [recipientPreview, setRecipientPreview] = useState<CampaignRecipientPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [segments, setSegments] = useState<GuestSegment[]>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null)
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null)
  const [editingSegmentName, setEditingSegmentName] = useState('')

  // Step 3 fields
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [launching, setLaunching] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (channel === 'whatsapp') {
      getMetaApprovedTemplates().then(all => setMetaTemplates(all.filter(t => t.is_active))).catch(() => {})
    }
  }, [channel])

  useEffect(() => {
    if (step === 2) {
      getGuestSegments(eventId).then(setSegments).catch(() => {})
    }
  }, [step, eventId])

  const step1ValidWhatsApp = selectedMetaTemplate !== null
  const step1ValidEmail = emailSubject.trim().length > 0 && emailBody.trim().length > 0
  const step1Valid = channel === 'email' ? step1ValidEmail : step1ValidWhatsApp

  const autoName = () => {
    if (channel === 'email') {
      return emailSubject.trim() || `Email — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    const type = selectedMetaTemplate?.message_type || 'message'
    return `${type.charAt(0).toUpperCase() + type.slice(1)} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  const handleStep1Next = async () => {
    if (creating || !step1Valid) return
    setCreating(true)
    try {
      const payload: Partial<MessageCampaign> = {
        name: autoName(),
        channel,
        template: null,
        guest_filter: 'all',
        filter_relationship: '',
        custom_guest_ids: [],
        scheduled_at: null,
      }
      if (channel === 'email') {
        payload.message_mode = 'freeform'
        payload.message_body = emailBody.trim()
        payload.subject = emailSubject.trim()
        payload.meta_template_name = ''
        payload.meta_template_language = 'en'
      } else {
        payload.message_mode = 'approved_template'
        payload.message_body = selectedMetaTemplate!.preview_text
        payload.meta_template_name = selectedMetaTemplate!.meta_template_name
        payload.meta_template_language = selectedMetaTemplate!.meta_template_language
        payload.subject = ''
      }
      const created = await createCampaign(eventId, payload)
      setCampaign(created)
      setStep(2)
      fetchPreview(created)
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? e?.response?.data?.detail ?? 'Failed to save message', 'error')
    } finally {
      setCreating(false)
    }
  }

  const fetchPreview = async (c: MessageCampaign) => {
    setPreviewLoading(true)
    try {
      const r = await previewCampaignRecipients(eventId, c.id)
      setRecipientPreview(r)
    } catch {
      setRecipientPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleFilterChange = async (filter: CampaignGuestFilter) => {
    setGuestFilter(filter)
    setSelectedSegmentId(null)
    if (!campaign) return
    try {
      const updated = await updateCampaign(eventId, campaign.id, {
        guest_filter: filter,
        filter_relationship: '',
        custom_guest_ids: [],
      })
      setCampaign(updated)
      fetchPreview(updated)
    } catch {
      showToast('Failed to update recipient filter', 'error')
    }
  }

  const handleSegmentSelect = async (segmentId: number) => {
    const seg = segments.find(s => s.id === segmentId)
    if (!seg || !campaign) return
    if (!seg.guest_ids || seg.guest_ids.length === 0) {
      showToast('This group has no guests. Refresh the group or add guests first.', 'error')
      return
    }
    setSelectedSegmentId(segmentId)
    setGuestFilter('custom_selection')
    try {
      const updated = await updateCampaign(eventId, campaign.id, {
        guest_filter: 'custom_selection',
        custom_guest_ids: seg.guest_ids,
      })
      setCampaign(updated)
      fetchPreview(updated)
    } catch {
      showToast('Failed to update recipient filter', 'error')
    }
  }

  const saveScheduleIfNeeded = async (): Promise<boolean> => {
    if (!campaign) return false
    if (scheduleMode === 'later' && scheduledAt) {
      try {
        const updated = await updateCampaign(eventId, campaign.id, {
          scheduled_at: new Date(scheduledAt).toISOString(),
        })
        setCampaign(updated)
      } catch {
        showToast('Failed to save schedule', 'error')
        return false
      }
    }
    return true
  }

  const handleStep3Next = async () => {
    if (scheduleMode === 'later' && !scheduledAt) return
    const ok = await saveScheduleIfNeeded()
    if (ok) setStep(4)
  }

  const handleSaveAsDraft = () => {
    showToast('Campaign saved as draft. Launch it from the Outbox when ready.', 'success')
    onCreated(campaign!)
  }

  const handleLaunch = async () => {
    if (!campaign) return
    setLaunching(true)
    try {
      const launched = await launchCampaign(eventId, campaign.id)
      showToast(
        scheduleMode === 'later'
          ? `Scheduled — will send on ${new Date(scheduledAt).toLocaleString()}.`
          : channel === 'email'
          ? 'Emails are being dispatched to your guests.'
          : 'Messages are being sent to your guests.',
        'success'
      )
      onCreated(launched)
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed to send messages', 'error')
    } finally {
      setLaunching(false)
    }
  }

  const eligibleCount = recipientPreview?.eligible_count ?? null
  const step2Valid = (guestFilter !== 'custom_selection' || selectedSegmentId !== null) && eligibleCount !== 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white border-2 border-eco-green-light max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-eco-green">
                {STEP_TITLES[step - 1]}
              </CardTitle>
              {channel === 'email' ? (
                <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-50 text-blue-600">Email</span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-50 text-green-700">WhatsApp</span>
              )}
            </div>
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
            {(['Message', 'Recipients', 'Schedule', 'Send'] as const).map((label, i) => {
              const s = (i + 1) as 1 | 2 | 3 | 4
              return (
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
                  {label}
                  {s < 4 && <span className={`w-6 h-px ${step > s ? 'bg-eco-green' : 'bg-gray-200'}`} />}
                </div>
              )
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ─── STEP 1 — WhatsApp ─── */}
          {step === 1 && channel === 'whatsapp' && (
            <>
              {metaTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No approved templates available yet. Ask your admin to add some.
                </div>
              ) : (
                <div className="space-y-2">
                  {metaTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedMetaTemplate(t)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                        selectedMetaTemplate?.id === t.id
                          ? 'border-eco-green bg-eco-green-light'
                          : 'border-gray-200 hover:border-eco-green-light'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-800">{t.display_name}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {t.message_type}
                        </span>
                        <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
                          {t.meta_template_language.toUpperCase()}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-gray-500 mb-1">{t.description}</p>
                      )}
                      <p className="text-xs text-gray-600 bg-white rounded p-2 whitespace-pre-wrap line-clamp-3">
                        {t.preview_text}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {selectedMetaTemplate && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Message preview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMetaTemplate.preview_text}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleStep1Next}
                  disabled={!step1Valid || creating}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  {creating ? 'Saving...' : 'Next →'}
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 1 — Email ─── */}
          {step === 1 && channel === 'email' && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject line <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. You're invited to our wedding!"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    maxLength={200}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                  />
                  <p className="text-xs text-gray-400 mt-1">{emailSubject.length}/200</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    You can use variables like <code className="bg-gray-100 px-1 rounded">[name]</code>,{' '}
                    <code className="bg-gray-100 px-1 rounded">[event_title]</code>,{' '}
                    <code className="bg-gray-100 px-1 rounded">[event_date]</code>,{' '}
                    <code className="bg-gray-100 px-1 rounded">[event_url]</code>
                  </p>
                  <textarea
                    placeholder="Write your email message here..."
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    rows={8}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{emailBody.length} characters</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleStep1Next}
                  disabled={!step1Valid || creating}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  {creating ? 'Saving...' : 'Next →'}
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 2 ─── */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleFilterChange(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      guestFilter === opt.value && selectedSegmentId === null
                        ? 'border-eco-green bg-eco-green-light'
                        : 'border-gray-200 hover:border-eco-green-light'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.description}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Your Groups</p>
                {segments.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No groups yet.{' '}
                    <a href={`/host/events/${eventId}/guests`} className="underline hover:text-eco-green">
                      Create groups in Guest Management →
                    </a>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {segments.map(seg => (
                      <div
                        key={seg.id}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                          selectedSegmentId === seg.id && guestFilter === 'custom_selection'
                            ? 'border-eco-green bg-eco-green-light'
                            : 'border-gray-200 hover:border-eco-green-light'
                        }`}
                      >
                        {editingSegmentId === seg.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={editingSegmentName}
                              onChange={e => setEditingSegmentName(e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                            />
                            <button
                              onClick={async () => {
                                if (!editingSegmentName.trim()) return
                                await updateGuestSegment(eventId, seg.id, { name: editingSegmentName.trim() })
                                setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, name: editingSegmentName.trim() } : s))
                                setEditingSegmentId(null)
                              }}
                              className="text-xs text-eco-green font-medium hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSegmentId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => handleSegmentSelect(seg.id)}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-800">{seg.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  seg.segment_type === 'dynamic' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {seg.segment_type === 'dynamic' ? 'Auto-updates' : 'Fixed'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{seg.guest_count} guests</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              {seg.segment_type === 'dynamic' && (
                                <button
                                  onClick={async () => {
                                    const fresh = await resolveGuestSegment(eventId, seg.id)
                                    setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, guest_count: fresh.count, guest_ids: fresh.guest_ids } : s))
                                  }}
                                  className="text-xs text-blue-500 hover:text-blue-700"
                                  title="Refresh count"
                                >↻</button>
                              )}
                              <button
                                onClick={() => { setEditingSegmentId(seg.id); setEditingSegmentName(seg.name) }}
                                className="text-xs text-gray-400 hover:text-eco-green"
                                title="Rename"
                              >✎</button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete group "${seg.name}"?`)) return
                                  await deleteGuestSegment(eventId, seg.id)
                                  setSegments(prev => prev.filter(s => s.id !== seg.id))
                                  if (selectedSegmentId === seg.id) { setSelectedSegmentId(null); setGuestFilter('all') }
                                }}
                                className="text-xs text-red-400 hover:text-red-600"
                                title="Delete"
                              >✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Recipient preview panel ── */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {previewLoading ? (
                  <div className="p-4 text-center text-sm text-gray-400">Loading recipients...</div>
                ) : recipientPreview === null ? (
                  <div className="p-4 text-center text-sm text-gray-400">Unable to load recipients</div>
                ) : recipientPreview.eligible_count === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm font-medium text-gray-500">No eligible recipients</p>
                    <p className="text-xs text-amber-600 mt-1">
                      {channel === 'email'
                        ? 'None of the selected guests have an email address.'
                        : 'None of the selected guests have a phone number.'}
                    </p>
                    <a
                      href={`/host/events/${eventId}/guests`}
                      className="text-xs text-eco-green underline mt-2 inline-block"
                    >
                      Update guest info →
                    </a>
                  </div>
                ) : (
                  <>
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-600">
                        {recipientPreview.eligible_count} recipient{recipientPreview.eligible_count !== 1 ? 's' : ''} will be messaged
                      </p>
                      {recipientPreview.missing_contact_count > 0 && (
                        <p className="text-xs font-medium text-amber-600">
                          +{recipientPreview.missing_contact_count} missing {recipientPreview.contact_field}
                        </p>
                      )}
                    </div>

                    {/* Guest rows */}
                    <ul className="divide-y divide-gray-100">
                      {recipientPreview.guests.map(g => (
                        <li key={g.id} className="flex items-center justify-between px-4 py-2">
                          <span className="text-sm text-gray-800 font-medium truncate max-w-[55%]">{g.name}</span>
                          <span className="text-xs text-gray-400 truncate max-w-[42%] text-right">{g.contact}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Overflow hint */}
                    {recipientPreview.eligible_count > recipientPreview.guests.length && (
                      <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-100">
                        + {recipientPreview.eligible_count - recipientPreview.guests.length} more
                      </p>
                    )}

                    {/* Missing contact warning */}
                    {recipientPreview.missing_contact_count > 0 && (
                      <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                        <p className="text-xs text-amber-700">
                          <strong>{recipientPreview.missing_contact_count}</strong> guest{recipientPreview.missing_contact_count !== 1 ? 's' : ''} in
                          this selection {recipientPreview.missing_contact_count !== 1 ? 'don\'t' : 'doesn\'t'} have{' '}
                          {channel === 'email' ? 'an email address' : 'a phone number'} and won't receive this{' '}
                          {channel === 'email' ? 'email' : 'message'}.{' '}
                          <a href={`/host/events/${eventId}/guests`} className="underline font-medium hover:text-amber-900">
                            Add their {recipientPreview.contact_field} →
                          </a>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!step2Valid}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  Next →
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 3 ─── */}
          {step === 3 && campaign && (
            <>
              <div className="flex gap-2">
                {(['now', 'later'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setScheduleMode(mode)}
                    className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      scheduleMode === mode
                        ? 'border-eco-green bg-eco-green text-white'
                        : 'border-gray-200 text-gray-600 hover:border-eco-green-light'
                    }`}
                  >
                    {mode === 'now' ? 'Send now' : 'Schedule for later'}
                  </button>
                ))}
              </div>

              {scheduleMode === 'later' && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                />
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                <Button
                  onClick={handleStep3Next}
                  disabled={scheduleMode === 'later' && !scheduledAt}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  Next →
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 4 ─── */}
          {step === 4 && campaign && (
            <>
              <div className="bg-eco-green-light border border-eco-green rounded-lg p-4 space-y-3 text-sm">
                <p className="font-semibold text-eco-green text-base">Campaign summary</p>
                <div className="flex justify-between">
                  <span className="text-gray-600">Channel</span>
                  <span className="font-medium text-gray-800 capitalize">{channel}</span>
                </div>
                {channel === 'email' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subject</span>
                    <span className="font-medium text-gray-800 text-right max-w-xs truncate">{emailSubject}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Message</span>
                  <span className="font-medium text-gray-800 text-right max-w-xs truncate">{campaign.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Recipients</span>
                  <span className="font-medium">
                    {eligibleCount !== null ? `${eligibleCount} guests` : '—'}
                    {recipientPreview && recipientPreview.missing_contact_count > 0 && (
                      <span className="text-amber-600 text-xs ml-2">
                        ({recipientPreview.missing_contact_count} skipped — no {recipientPreview.contact_field})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Send time</span>
                  <span className="font-medium">
                    {scheduleMode === 'now'
                      ? 'Immediately on launch'
                      : scheduledAt
                      ? new Date(scheduledAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <button
                  onClick={handleSaveAsDraft}
                  className="w-full flex items-start gap-4 px-5 py-4 rounded-lg border-2 border-gray-200 hover:border-eco-green-light text-left transition-colors"
                >
                  <span className="text-2xl mt-0.5">📋</span>
                  <div>
                    <p className="font-semibold text-gray-800">Save as Draft</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Keep this campaign in your Outbox. You can edit and launch it whenever you're ready.
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleLaunch}
                  disabled={launching}
                  className="w-full flex items-start gap-4 px-5 py-4 rounded-lg border-2 border-eco-green bg-eco-green hover:bg-green-600 text-left transition-colors disabled:opacity-60"
                >
                  <span className="text-2xl mt-0.5">🚀</span>
                  <div>
                    <p className="font-semibold text-white">
                      {launching ? 'Launching...' : scheduleMode === 'now' ? 'Launch Now' : 'Schedule & Launch'}
                    </p>
                    <p className="text-xs text-green-100 mt-0.5">
                      {scheduleMode === 'now'
                        ? `${channel === 'email' ? 'Emails' : 'Messages'} will be dispatched to guests immediately.`
                        : `${channel === 'email' ? 'Emails' : 'Messages'} will go out on ${new Date(scheduledAt).toLocaleString()}.`}
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex justify-start pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
