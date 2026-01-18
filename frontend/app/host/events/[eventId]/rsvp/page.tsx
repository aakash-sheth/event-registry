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

  useEffect(() => {
    const load = async () => {
      if (!eventId || isNaN(eventId)) return
      try {
        const resp = await api.get(`/api/events/${eventId}/`)
        const e = resp.data as Event
        setEvent(e)

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

  const handleSave = async () => {
    if (!eventId || !event) return
    setSaving(true)
    try {
      const base: InviteConfig = (pageConfig || (event.page_config as any) || { themeId: 'classic-noir' }) as any
      const next: InviteConfig = {
        ...(base as any),
        themeId: (base as any).themeId || 'classic-noir',
        rsvpForm: (rsvpForm as any) || { version: 1 },
      }

      await api.put(`/api/events/${eventId}/design/`, { page_config: next })
      setPageConfig(next)
      showToast('RSVP form settings saved', 'success')
    } catch (error: any) {
      logError('Failed to save RSVP settings:', error)
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
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">RSVP Settings</h1>
            <p className="text-sm text-gray-600 mt-1">
              Configure which fields guests see on your RSVP form.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/host/events/${eventId}`}>
              <Button variant="outline">Back to Event</Button>
            </Link>
            <Link href={`/event/${event.slug}/rsvp`} target="_blank">
              <Button variant="outline">Preview RSVP Page</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving || !event.has_rsvp} className="bg-eco-green hover:bg-green-600 text-white">
              {saving ? 'Saving…' : 'Save'}
            </Button>
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
            <CardTitle className="text-eco-green">RSVP Form</CardTitle>
          </CardHeader>
          <CardContent>
            <RsvpFormEditor
              value={rsvpForm}
              onChange={setRsvpForm}
              customFieldsMetadata={metadata}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

