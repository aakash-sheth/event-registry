'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface BookingSchedule {
  is_enabled: boolean
  seat_visibility_mode: 'exact' | 'bucketed' | 'hidden'
  allow_direct_bookings: boolean
  booking_open_days_before: number | null
  booking_close_hours_before: number | null
  status_changed_at?: string
}

interface BookingSlot {
  id: number
  slot_date: string
  start_at: string
  end_at: string
  label: string
  capacity_total: number
  remaining_seats: number
  status: 'available' | 'unavailable' | 'sold_out' | 'hidden'
}

interface EventLite {
  id: number
  slug: string
  timezone?: string
  rsvp_experience_mode?: 'standard' | 'sub_event' | 'slot_based'
  rsvp_mode_readiness?: {
    mode: 'standard' | 'sub_event' | 'slot_based'
    ready: boolean
    reasons: string[]
  }
}

export default function SlotBookingPage() {
  const params = useParams()
  const eventId = Number(params.eventId)
  const { showToast } = useToast()

  const [event, setEvent] = useState<EventLite | null>(null)
  const [schedule, setSchedule] = useState<BookingSchedule | null>(null)
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [updatingSlotId, setUpdatingSlotId] = useState<number | null>(null)
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null)
  const [form, setForm] = useState({
    slot_date: '',
    start_time: '',
    end_time: '',
    label: '',
    capacity_total: '1',
  })

  const byDate = useMemo(() => {
    const grouped: Record<string, BookingSlot[]> = {}
    for (const slot of slots) {
      grouped[slot.slot_date] = grouped[slot.slot_date] || []
      grouped[slot.slot_date].push(slot)
    }
    return grouped
  }, [slots])

  const slotCount = slots.length
  const hasActiveSlot = slots.some((slot) => slot.status === 'available')
  const isSlotModeActive = event?.rsvp_experience_mode === 'slot_based'
  const isBookingPaused = Boolean(isSlotModeActive && schedule && !schedule.is_enabled)
  const statusChangedText =
    schedule?.status_changed_at ? new Date(schedule.status_changed_at).toLocaleString() : null
  const readinessReasons = (event?.rsvp_mode_readiness?.reasons || []).filter((reason) => {
    if (!isBookingPaused) return true
    return !reason.toLowerCase().includes('enable slot settings')
  })

  const load = async () => {
    try {
      const [eventRes, scheduleRes, slotRes] = await Promise.all([
        api.get(`/api/events/${eventId}/`),
        api.get(`/api/events/${eventId}/booking-schedule/`),
        api.get(`/api/events/${eventId}/booking-slots/`),
      ])
      setEvent(eventRes.data)
      setSchedule(scheduleRes.data)
      setSlots(slotRes.data || [])
    } catch (error) {
      showToast('Failed to load slot settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (eventId) load()
  }, [eventId])

  const autoSaveSchedule = async (patch: Partial<BookingSchedule>) => {
    if (!schedule) return
    const prev = schedule
    const optimistic = { ...schedule, ...patch }
    setSchedule(optimistic)
    setSavingPolicy(true)
    try {
      const res = await api.put(`/api/events/${eventId}/booking-schedule/`, patch)
      setSchedule(res.data)
    } catch {
      setSchedule(prev)
      showToast('Failed to save booking controls', 'error')
    } finally {
      setSavingPolicy(false)
    }
  }

  const createSlot = async () => {
    const capacity = Number(form.capacity_total)
    if (!form.slot_date || !form.start_time || !form.end_time) {
      showToast('Please select date, start time, and end time', 'error')
      return
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      showToast('Capacity must be at least 1', 'error')
      return
    }
    const startAt = `${form.slot_date}T${form.start_time}`
    const endAt = `${form.slot_date}T${form.end_time}`
    if (endAt <= startAt) {
      showToast('End time must be after start time', 'error')
      return
    }

    setCreating(true)
    try {
      await api.post(`/api/events/${eventId}/booking-slots/`, {
        slot_date: form.slot_date,
        start_at: startAt,
        end_at: endAt,
        label: form.label,
        capacity_total: capacity,
      })
      setForm({ slot_date: '', start_time: '', end_time: '', label: '', capacity_total: '1' })
      await load()
      showToast('Slot created', 'success')
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === 'string' ? error.response.data : '') ||
        'Failed to create slot'
      showToast(msg, 'error')
    } finally {
      setCreating(false)
    }
  }

  const formatTimeInEventTz = (iso: string) => {
    const tz = event?.timezone || 'UTC'
    const d = new Date(iso)
    // "en-CA" gives zero-padded HH:mm in 24h format.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const hour = parts.find((p) => p.type === 'hour')?.value || '00'
    const minute = parts.find((p) => p.type === 'minute')?.value || '00'
    return `${hour}:${minute}`
  }

  const updateSlot = async () => {
    if (!editingSlotId) return
    const capacity = Number(form.capacity_total)
    if (!form.slot_date || !form.start_time || !form.end_time) {
      showToast('Please select date, start time, and end time', 'error')
      return
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      showToast('Capacity must be at least 1', 'error')
      return
    }
    const startAt = `${form.slot_date}T${form.start_time}`
    const endAt = `${form.slot_date}T${form.end_time}`
    if (endAt <= startAt) {
      showToast('End time must be after start time', 'error')
      return
    }

    setCreating(true)
    try {
      await api.patch(`/api/events/${eventId}/booking-slots/${editingSlotId}/`, {
        slot_date: form.slot_date,
        start_at: startAt,
        end_at: endAt,
        label: form.label,
        capacity_total: capacity,
      })
      setEditingSlotId(null)
      setForm({ slot_date: '', start_time: '', end_time: '', label: '', capacity_total: '1' })
      await load()
      showToast('Slot updated', 'success')
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === 'string' ? error.response.data : '') ||
        'Failed to update slot'
      showToast(msg, 'error')
    } finally {
      setCreating(false)
    }
  }

  const beginEditSlot = (slot: BookingSlot) => {
    setEditingSlotId(slot.id)
    setForm((prev) => ({
      ...prev,
      slot_date: slot.slot_date,
      start_time: formatTimeInEventTz(slot.start_at),
      end_time: formatTimeInEventTz(slot.end_at),
      label: slot.label || '',
      capacity_total: String(slot.capacity_total),
    }))
  }

  const updateSlotStatus = async (slotId: number, status: BookingSlot['status']) => {
    setUpdatingSlotId(slotId)
    try {
      await api.patch(`/api/events/${eventId}/booking-slots/${slotId}/`, { status })
      await load()
      showToast('Slot updated', 'success')
    } catch {
      showToast('Failed to update slot', 'error')
    } finally {
      setUpdatingSlotId(null)
    }
  }

  const duplicateSlot = async (slot: BookingSlot) => {
    setUpdatingSlotId(slot.id)
    try {
      await api.post(`/api/events/${eventId}/booking-slots/`, {
        slot_date: slot.slot_date,
        start_at: slot.start_at,
        end_at: slot.end_at,
        label: `${slot.label || 'Slot'} (copy)`,
        capacity_total: slot.capacity_total,
      })
      await load()
      showToast('Slot duplicated', 'success')
    } catch {
      showToast('Failed to duplicate slot', 'error')
    } finally {
      setUpdatingSlotId(null)
    }
  }

  const deleteSlot = async (slotId: number) => {
    setUpdatingSlotId(slotId)
    try {
      await api.delete(`/api/events/${eventId}/booking-slots/${slotId}/`)
      await load()
      showToast('Slot deleted', 'success')
    } catch {
      showToast('Failed to delete slot', 'error')
    } finally {
      setUpdatingSlotId(null)
    }
  }

  const statusChipClass = (status: BookingSlot['status']) => {
    if (status === 'available') return 'bg-green-100 text-green-800'
    if (status === 'sold_out') return 'bg-orange-100 text-orange-800'
    if (status === 'hidden') return 'bg-gray-200 text-gray-700'
    return 'bg-yellow-100 text-yellow-800'
  }

  if (loading) return <div className="p-6">Loading slot settings...</div>

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Slot Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSlotModeActive && (
            <p className="text-sm text-gray-600">
              Activate Slot-based RSVP from RSVP Settings before collecting slot bookings.
            </p>
          )}
          {!isSlotModeActive && event?.id && (
            <Link href={`/host/events/${event.id}/rsvp`} className="inline-block text-sm text-eco-green hover:underline">
              Open RSVP Settings
            </Link>
          )}

          <div className="rounded-md border p-4 space-y-4">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Booking Status</p>
                <p className="text-xs text-gray-600">Control whether guests can place slot bookings now.</p>
              </div>
              <div className="grid grid-cols-[88px_48px_88px] items-center justify-end gap-3">
                <span className={`text-right text-xs font-medium ${schedule?.is_enabled ? 'text-gray-500' : 'text-gray-900'}`}>
                  Pause
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!schedule?.is_enabled}
                  aria-label="Toggle booking status"
                  disabled={!schedule || savingPolicy}
                  onClick={() => schedule && autoSaveSchedule({ is_enabled: !schedule.is_enabled })}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                    schedule?.is_enabled ? 'bg-eco-green' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      schedule?.is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-left text-xs font-medium ${schedule?.is_enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                  Active
                </span>
              </div>
            </div>
            {schedule?.is_enabled && statusChangedText && (
              <p className="text-xs text-green-700">Bookings are active since {statusChangedText}</p>
            )}

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">Booking Audience</p>
              <p className="text-xs text-gray-600">Choose who can book when status is Active.</p>
              <div className="grid grid-cols-[88px_48px_88px] items-center justify-end gap-3">
                <span className={`text-right text-xs font-medium ${schedule?.allow_direct_bookings ? 'text-gray-500' : 'text-gray-900'}`}>
                  Invite Only
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!schedule?.allow_direct_bookings}
                  aria-label="Toggle booking audience"
                  disabled={!schedule || savingPolicy}
                  onClick={() =>
                    schedule && autoSaveSchedule({ allow_direct_bookings: !schedule.allow_direct_bookings })
                  }
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                    schedule?.allow_direct_bookings ? 'bg-eco-green' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      schedule?.allow_direct_bookings ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-left text-xs font-medium ${schedule?.allow_direct_bookings ? 'text-gray-900' : 'text-gray-500'}`}>
                  Open to All
                </span>
              </div>
            </div>
          </div>

          {/*
            Auto-saves on toggle. Keep the UI lean to avoid redundant actions.
          */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
              <CardTitle>{editingSlotId ? 'Edit Slot' : 'Create Slot'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Add one slot at a time. Start and end should be in event timezone.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs mb-1 text-gray-600">Date</p>
                  <Input
                    type="date"
                    value={form.slot_date}
                    onChange={(e) => setForm((p) => ({ ...p, slot_date: e.target.value }))}
                  />
            </div>
            <div>
              <p className="text-xs mb-1 text-gray-600">Start time</p>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  />
            </div>
            <div>
              <p className="text-xs mb-1 text-gray-600">End time</p>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs mb-1 text-gray-600">Label (optional)</p>
              <Input placeholder="e.g. Morning batch" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs mb-1 text-gray-600">Capacity</p>
              <Input
                    type="text"
                    value={form.capacity_total}
                    onChange={(e) => setForm((p) => ({ ...p, capacity_total: e.target.value }))}
              />
            </div>
          </div>
              <Button
                disabled={creating}
                onClick={editingSlotId ? updateSlot : createSlot}
                className="w-full"
              >
                {creating ? (editingSlotId ? 'Updating...' : 'Creating...') : editingSlotId ? 'Update Slot' : 'Add Slot'}
          </Button>
              {editingSlotId && (
                <Button
                  variant="outline"
                  disabled={creating}
                  onClick={() => {
                    setEditingSlotId(null)
                    setForm({ slot_date: '', start_time: '', end_time: '', label: '', capacity_total: '1' })
                  }}
                  className="w-full"
                >
                  Cancel Edit
                </Button>
              )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slots by Date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(byDate).length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-sm text-gray-600">
              No slots yet. Add your first slot to start collecting bookings.
            </div>
          )}
          {Object.entries(byDate).map(([date, daySlots]) => (
            <div key={date}>
              <h3 className="font-medium mb-2">{date}</h3>
              <div className="space-y-2">
                {daySlots.map((slot) => (
                  <div key={slot.id} className="p-3 border rounded-md text-sm flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {slot.label ? <div className="font-medium">{slot.label}</div> : null}
                        <span className={`rounded px-2 py-0.5 text-xs ${statusChipClass(slot.status)}`}>
                          {slot.status}
                        </span>
                      </div>
                      <div className="text-gray-600">{new Date(slot.start_at).toLocaleString()} - {new Date(slot.end_at).toLocaleString()}</div>
                      <div className="text-xs text-gray-500 mt-1">{slot.remaining_seats}/{slot.capacity_total} seats left</div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingSlotId === slot.id}
                        onClick={() => updateSlotStatus(slot.id, slot.status === 'hidden' ? 'available' : 'hidden')}
                      >
                        {slot.status === 'hidden' ? 'Unhide' : 'Hide'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingSlotId === slot.id}
                        onClick={() => duplicateSlot(slot)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingSlotId === slot.id}
                        onClick={() => beginEditSlot(slot)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingSlotId === slot.id}
                        onClick={() => deleteSlot(slot.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
