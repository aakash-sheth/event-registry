'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import type { InviteConfig, RsvpFormConfig } from '@/lib/invite/schema'
import RsvpFormEditor from '@/components/rsvp/RsvpFormEditor'

interface Event {
  id: number
  slug: string
  title: string
  has_rsvp: boolean
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  rsvp_mode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  rsvp_experience_mode?: 'standard' | 'sub_event' | 'slot_based'
  rsvp_mode_readiness?: {
    mode: 'standard' | 'sub_event' | 'slot_based'
    ready: boolean
    reasons: string[]
  }
  mode_switch_locked?: boolean
  mode_switch_lock_reasons?: string[]
  custom_fields_metadata?: Record<string, any>
  page_config?: InviteConfig
}

export default function HostRsvpSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  const eventId = params.eventId ? parseInt(params.eventId as string) : 0
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [event, setEvent] = useState<Event | null>(null)
  const [pageConfig, setPageConfig] = useState<InviteConfig | null>(null)
  const [rsvpForm, setRsvpForm] = useState<RsvpFormConfig | undefined>(undefined)
  const [activeMode, setActiveMode] = useState<'standard' | 'sub_event' | 'slot_based'>('standard')
  const [subEventMode, setSubEventMode] = useState<'PER_SUBEVENT' | 'ONE_TAP_ALL'>('PER_SUBEVENT')
  const [saveError, setSaveError] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      if (!eventId || isNaN(eventId)) return
      try {
        const resp = await api.get(`/api/events/${eventId}/`)
        const e = resp.data as Event
        setEvent(e)
        setActiveMode((e.rsvp_experience_mode as any) || 'standard')
        setSubEventMode((e.rsvp_mode as any) || 'PER_SUBEVENT')

        const pc: InviteConfig | null = (e.page_config as any) || null
        setPageConfig(pc)
        setRsvpForm((pc as any)?.rsvpForm as RsvpFormConfig | undefined)
      } catch (error: any) {
        if (error.response?.status === 401) {
          router.push('/host/login')
          return
        }
        logError('Failed to load RSVP settings:', error)
        showToast(getErrorMessage(error), 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, router, showToast])

  const metadata = useMemo(() => (event?.custom_fields_metadata || {}) as Record<string, any>, [event])
  const persistedMode = event?.rsvp_experience_mode || 'standard'
  const modeSwitchLocked = Boolean(event?.mode_switch_locked)
  const modeDirty = persistedMode !== activeMode
  const modeLabel = activeMode === 'standard' ? 'Standard RSVP' : activeMode === 'sub_event' ? 'Sub-event RSVP' : 'Slot-based RSVP'

  const slotReadinessReasonsText = (event?.rsvp_mode_readiness?.reasons || []).join(' ').toLowerCase()
  const slotFixText = slotReadinessReasonsText.includes('paused')
    ? 'Activate bookings in Slot Settings'
    : slotReadinessReasonsText.includes('active slot')
      ? 'Add active slots in Slot Settings'
      : 'Fix in Slot Settings'

  const getModeActionLink = (mode: 'standard' | 'sub_event' | 'slot_based') => {
    if (!eventId) return null
    if (mode === 'sub_event') return `/host/events/${eventId}/sub-events`
    if (mode === 'slot_based') return `/host/events/${eventId}/slot-booking`
    return null
  }

  const handleSave = async () => {
    if (!eventId || !event) return
    setSaveError('')
    if (modeDirty && !modeSwitchLocked) {
      const confirmed = window.confirm(
        'Switching RSVP mode changes the guest RSVP experience for this event. Continue?'
      )
      if (!confirmed) return
    }
    setSaving(true)
    try {
      const eventPayload: Record<string, any> = {
        rsvp_experience_mode: activeMode,
      }
      if (activeMode === 'sub_event') {
        eventPayload.rsvp_mode = subEventMode
      }
      const eventResponse = await api.patch(`/api/events/${eventId}/`, eventPayload)
      const updatedEvent = eventResponse.data as Event
      setEvent(updatedEvent)

      const base: InviteConfig = (pageConfig || (event.page_config as any) || { themeId: 'classic-noir' }) as any
      const next: InviteConfig = {
        ...(base as any),
        themeId: (base as any).themeId || 'classic-noir',
        rsvpForm: (rsvpForm as any) || { version: 1 },
      }

      await api.put(`/api/events/${eventId}/design/`, { page_config: next })
      setPageConfig(next)
      showToast('RSVP form settings saved', 'success')
      if (
        activeMode === 'slot_based' &&
        !updatedEvent?.rsvp_mode_readiness?.ready
      ) {
        const noSlotsReason = (updatedEvent.rsvp_mode_readiness?.reasons || []).find((r) =>
          r.toLowerCase().includes('slot')
        )
        showToast(
          noSlotsReason || 'Slot-based RSVP saved, but no slots are available yet.',
          'info'
        )
      }
    } catch (error: any) {
      logError('Failed to save RSVP settings:', error)
      const backendError =
        error?.response?.data?.rsvp_experience_mode?.[0] ||
        error?.response?.data?.rsvp_experience_mode ||
        error?.response?.data?.error ||
        ''
      if (backendError) {
        setSaveError(String(backendError))
      }
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Event not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-4xl mx-auto px-4 py-8">
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
                  Guests
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link href={`/event/${event.slug}/rsvp`} target="_blank">
                <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                  Preview RSVP Page
                </Button>
              </Link>
              <Button
                onClick={handleSave}
                disabled={saving || !event.has_rsvp}
                size="sm"
                className="bg-eco-green hover:bg-green-600 text-white"
              >
                {saving ? 'Saving…' : modeDirty ? 'Save RSVP Settings (Unsaved mode change)' : 'Save RSVP Settings'}
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-eco-green">RSVP Settings</h1>
            <p className="text-sm text-gray-600 mt-1">
              Configure which fields guests see on your RSVP form.
            </p>
          </div>
        </div>

        {!event.has_rsvp && (
          <Card className="bg-white border-2 border-yellow-200 mb-6">
            <CardHeader>
              <CardTitle className="text-yellow-800">RSVP is disabled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                Enable RSVP from <strong>Event Features</strong> on the event dashboard to edit the RSVP form.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">RSVP Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">Choose how guests respond.</p>
            {modeSwitchLocked && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">RSVP mode is locked</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  You cannot switch modes after guests have submitted RSVPs or confirmed slot bookings. You can still
                  edit form fields and settings for the current mode.
                </p>
                {!!event?.mode_switch_lock_reasons?.length && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-amber-900/90">
                    {event.mode_switch_lock_reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'standard'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'standard' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'standard'}
                    disabled={modeSwitchLocked && persistedMode !== 'standard'}
                    onChange={() => setActiveMode('standard')}
                  />
                  <span className="font-medium">Standard RSVP</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Use for one attendance response per guest.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'standard' ? 'Selected' : 'Not selected'}</p>
              </label>
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'sub_event'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'sub_event' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'sub_event'}
                    disabled={modeSwitchLocked && persistedMode !== 'sub_event'}
                    onChange={() => setActiveMode('sub_event')}
                  />
                  <span className="font-medium">Sub-event RSVP</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Use when guests can RSVP for different event parts.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'sub_event' ? 'Selected' : 'Not selected'}</p>
              </label>
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'slot_based'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'slot_based' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'slot_based'}
                    disabled={modeSwitchLocked && persistedMode !== 'slot_based'}
                    onChange={() => setActiveMode('slot_based')}
                  />
                  <span className="font-medium">Slot-based RSVP</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Use when guests must pick a date and time slot.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'slot_based' ? 'Selected' : 'Not selected'}</p>
              </label>
            </div>
            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {activeMode === 'sub_event' && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">Sub-event response style</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sub_event_mode_selector"
                      checked={subEventMode === 'PER_SUBEVENT'}
                      onChange={() => setSubEventMode('PER_SUBEVENT')}
                    />
                    Per sub-event
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sub_event_mode_selector"
                      checked={subEventMode === 'ONE_TAP_ALL'}
                      onChange={() => setSubEventMode('ONE_TAP_ALL')}
                    />
                    One tap all
                  </label>
                </div>
                <Link href={`/host/events/${eventId}/sub-events`} className="mt-3 inline-block text-sm text-eco-green hover:underline">
                  Manage sub-events
                </Link>
              </div>
            )}

            {activeMode === 'slot_based' && (
              <div className="rounded-md border p-3">
                <p className="text-sm text-gray-700">
                  Guests confirm attendance by booking a slot, or they can explicitly decline.
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Keep slot availability updated before sharing RSVP links.
                </p>
                <div className="mt-2">
                  <Link href={`/host/events/${eventId}/slot-booking`}>
                    <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                      Open Slot Settings
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {activeMode === 'standard' && (
              <div className="rounded-md border p-3">
                <p className="text-sm text-gray-700">
                  Guests submit a single RSVP response for the event.
                </p>
              </div>
            )}

            {!!event?.rsvp_mode_readiness && (
              <div className={`rounded-md border p-3 ${event.rsvp_mode_readiness.ready ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                <p className="text-sm font-medium">
                  {event.rsvp_mode_readiness.ready ? `Ready: ${modeLabel}` : `Incomplete: ${modeLabel}`}
                </p>
                {!!event.rsvp_mode_readiness.reasons?.length && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">
                    {event.rsvp_mode_readiness.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
                {!event.rsvp_mode_readiness.ready && !!getModeActionLink(activeMode) && (
                  <Link href={getModeActionLink(activeMode) as string} className="mt-2 inline-block text-xs font-medium text-eco-green hover:underline">
                    {activeMode === 'sub_event' ? 'Fix in Sub-events' : slotFixText}
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">RSVP Form</CardTitle>
          </CardHeader>
          <CardContent>
            <RsvpFormEditor
              value={rsvpForm}
              onChange={setRsvpForm}
              customFieldsMetadata={metadata}
              activeMode={activeMode}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

