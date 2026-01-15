'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api, { uploadImage } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import { Calendar, MapPin, Clock, Plus, Edit, Trash2, Eye, EyeOff, Maximize2 } from 'lucide-react'
import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'
import RichTextEditor from '@/components/invite/RichTextEditor'
import DescriptionEditorModal from '@/components/invite/DescriptionEditorModal'

interface Event {
  id: number
  slug: string
  title: string
  event_structure: 'SIMPLE' | 'ENVELOPE'
  rsvp_mode: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  timezone?: string
}

interface SubEvent {
  id: number
  title: string
  start_at: string
  end_at?: string | null
  location: string
  description?: string | null
  image_url?: string | null
  background_color?: string | null
  rsvp_enabled: boolean
  is_public_visible: boolean
}

export default function SubEventsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId ? parseInt(params.eventId as string) : 0
  const { showToast } = useToast()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [subEvents, setSubEvents] = useState<SubEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSubEvent, setEditingSubEvent] = useState<SubEvent | null>(null)
  
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    start_at: '',
    end_at: '',
    location: '',
    description: '',
    image_url: '',
    background_color: '#ffffff',
    rsvp_enabled: true,
    is_public_visible: false,
  })
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set())

  const eventTimezone = event?.timezone || 'Asia/Kolkata'

  const toDateTimeLocalInputValueInTimeZone = (isoString: string, timeZone: string) => {
    // Convert stored ISO timestamp (UTC instant) to `datetime-local` value in EVENT timezone wall-time.
    try {
      const d = new Date(isoString)
      if (Number.isNaN(d.getTime())) return ''
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const parts = fmt.formatToParts(d)
      const get = (type: string) => parts.find(p => p.type === type)?.value
      const year = get('year')
      const month = get('month')
      const day = get('day')
      const hour = get('hour')
      const minute = get('minute')
      if (!year || !month || !day || !hour || !minute) return ''
      return `${year}-${month}-${day}T${hour}:${minute}`
    } catch {
      return ''
    }
  }

  const dateTimeLocalInTimeZoneToUtcISOString = (dateTimeLocal: string, timeZone: string) => {
    // Interpret `YYYY-MM-DDTHH:mm` as EVENT timezone wall-time, then store as UTC ISO instant.
    try {
      const m = dateTimeLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
      if (!m) return new Date(dateTimeLocal).toISOString()
      const [, ys, mos, ds, hs, mins] = m
      const y = Number(ys)
      const mo = Number(mos)
      const d = Number(ds)
      const h = Number(hs)
      const min = Number(mins)

      // Initial guess: treat the desired wall-time as if it were UTC.
      let utc = new Date(Date.UTC(y, mo - 1, d, h, min, 0))

      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const getTzParts = (date: Date) => {
        const parts = fmt.formatToParts(date)
        const get = (type: string) => parts.find(p => p.type === type)?.value
        return {
          year: Number(get('year')),
          month: Number(get('month')),
          day: Number(get('day')),
          hour: Number(get('hour')),
          minute: Number(get('minute')),
        }
      }

      const desiredMs = Date.UTC(y, mo - 1, d, h, min, 0)
      for (let i = 0; i < 2; i++) {
        const tzp = getTzParts(utc)
        const tzMs = Date.UTC(tzp.year, tzp.month - 1, tzp.day, tzp.hour, tzp.minute, 0)
        const diffMs = desiredMs - tzMs
        utc = new Date(utc.getTime() + diffMs)
      }
      return utc.toISOString()
    } catch {
      return new Date(dateTimeLocal).toISOString()
    }
  }

  useEffect(() => {
    if (!eventId || isNaN(eventId)) {
      router.push('/host/dashboard')
      return
    }
    fetchEvent()
    fetchSubEvents()
  }, [eventId, router])

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else {
        logError('Failed to fetch event:', error)
        showToast(getErrorMessage(error), 'error')
      }
    }
  }

  const fetchSubEvents = async () => {
    try {
      const response = await api.get(`/api/events/envelopes/${eventId}/sub-events/`)
      setSubEvents(response.data.results || response.data || [])
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Event might not be ENVELOPE yet, that's okay
        setSubEvents([])
      } else {
        logError('Failed to fetch sub-events:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = (e?: React.MouseEvent) => {
    setEditingSubEvent(null)
    setFormData({
      title: '',
      start_at: '',
      end_at: '',
      location: '',
      description: '',
      image_url: '',
      background_color: '#ffffff',
      rsvp_enabled: true,
      is_public_visible: false,
    })
    setShowCreateModal(true)
  }

  const handleEdit = (subEvent: SubEvent) => {
    setEditingSubEvent(subEvent)
    setFormData({
      title: subEvent.title,
      start_at: toDateTimeLocalInputValueInTimeZone(subEvent.start_at, eventTimezone),
      end_at: subEvent.end_at ? toDateTimeLocalInputValueInTimeZone(subEvent.end_at, eventTimezone) : '',
      location: subEvent.location || '',
      description: subEvent.description || '',
      image_url: subEvent.image_url || '',
      background_color: subEvent.background_color || '#ffffff',
      rsvp_enabled: subEvent.rsvp_enabled,
      is_public_visible: subEvent.is_public_visible,
    })
    setShowCreateModal(true)
  }

  const handleDelete = async (subEventId: number) => {
    if (!confirm('Are you sure you want to delete this sub-event?')) {
      return
    }

    try {
      await api.delete(`/api/events/sub-events/${subEventId}/`)
      showToast('Sub-event deleted successfully', 'success')
      fetchSubEvents()
    } catch (error: any) {
      logError('Failed to delete sub-event:', error)
      showToast(getErrorMessage(error), 'error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      ...formData,
      start_at: dateTimeLocalInTimeZoneToUtcISOString(formData.start_at, eventTimezone),
      end_at: formData.end_at ? dateTimeLocalInTimeZoneToUtcISOString(formData.end_at, eventTimezone) : null,
      description: formData.description || null,
      image_url: formData.image_url || null,
      background_color: formData.background_color || null,
    }

    try {
      if (editingSubEvent) {
        await api.put(`/api/events/sub-events/${editingSubEvent.id}/`, payload)
        showToast('Sub-event updated successfully', 'success')
      } else {
        await api.post(`/api/events/envelopes/${eventId}/sub-events/`, payload)
        showToast('Sub-event created successfully', 'success')
      }

      setShowCreateModal(false)
      fetchSubEvents()
      fetchEvent() // Refresh event to check if it upgraded to ENVELOPE
    } catch (error: any) {
      logError('Failed to save sub-event:', error)
      if (process.env.NODE_ENV === 'development') {
        console.error('Sub-event save error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          payload: payload
        })
      }
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const formatted = date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: eventTimezone,
      })
      return `${formatted} (${eventTimezone})`
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <p className="text-gray-600">Loading sub-events...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <div className="text-center">
          <p className="text-red-500 mb-4">Event not found</p>
          <Link href="/host/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Show message if event is not ENVELOPE yet
  if (event.event_structure === 'SIMPLE' && subEvents.length === 0) {
    return (
      <div className="min-h-screen bg-eco-beige p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link href={`/host/events/${eventId}`}>
              <Button variant="outline">← Back to Event</Button>
            </Link>
          </div>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Sub-Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Create your first sub-event to automatically upgrade this event to ENVELOPE mode.
              </p>
                <button
                  onClick={handleCreate}
                  className="bg-eco-green hover:bg-green-600 text-white inline-flex items-center justify-center rounded-md font-medium transition-colors px-4 py-2 cursor-pointer"
                  type="button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Sub-Event
                </button>
            </CardContent>
          </Card>

          {/* Create/Edit Modal - for SIMPLE events */}
          {showCreateModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowCreateModal(false)
                }
              }}
            >
              <Card 
                className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{editingSubEvent ? 'Edit Sub-Event' : 'Create Sub-Event'}</CardTitle>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
                      type="button"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.start_at}
                          onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.end_at}
                          onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        placeholder="Event location"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsDescriptionModalOpen(true)}
                          className="text-xs border-eco-green text-eco-green hover:bg-eco-green hover:text-white"
                        >
                          <Maximize2 className="h-3 w-3 mr-1" />
                          Full Screen Editor
                        </Button>
                      </div>
                      <RichTextEditor
                        value={formData.description || ''}
                        onChange={(value) => setFormData({ ...formData, description: value })}
                        placeholder="Enter sub-event description..."
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Use the toolbar to format text and add links. Click "Full Screen Editor" for a larger editing area.
                      </p>
                      <DescriptionEditorModal
                        isOpen={isDescriptionModalOpen}
                        onClose={() => setIsDescriptionModalOpen(false)}
                        value={formData.description || ''}
                        onChange={(value) => setFormData({ ...formData, description: value })}
                        placeholder="Enter sub-event description..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Image
                      </label>
                      <div className="space-y-2">
                        {formData.image_url && (
                          <div className="relative w-full h-48 border border-gray-300 rounded-md overflow-hidden bg-gray-100">
                            <img
                              src={formData.image_url}
                              alt="Sub-event preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, image_url: '' })}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        )}
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploadingImage ? (
                              <>
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eco-green mb-2"></div>
                                <p className="text-sm text-gray-600">Uploading...</p>
                              </>
                            ) : (
                              <>
                                <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-sm text-gray-600">
                                  <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return

                              if (file.size > 5 * 1024 * 1024) {
                                showToast('Image must be less than 5MB', 'error')
                                return
                              }

                              if (!file.type.startsWith('image/')) {
                                showToast('Please upload an image file', 'error')
                                return
                              }

                              setUploadingImage(true)
                              try {
                                const imageUrl = await uploadImage(file, eventId)
                                // Update UI immediately with uploaded image
                                setFormData({ ...formData, image_url: imageUrl })
                                showToast('Image uploaded successfully', 'success')
                                
                                // Extract dominant color for background asynchronously (non-blocking)
                                extractDominantColors(imageUrl, 3)
                                  .then((colors) => {
                                    const primaryColor = rgbToHex(colors[0] || 'rgb(0,0,0)')
                                    setFormData((prev) => ({
                                      ...prev,
                                      background_color: primaryColor,
                                    }))
                                  })
                                  .catch((error) => {
                                    if (process.env.NODE_ENV === 'development') {
                                      console.error('Error extracting dominant colors (non-critical):', error)
                                    }
                                    // Color extraction failed, but image is already uploaded and displayed
                                    // User can manually set background color if needed
                                  })
                              } catch (error: any) {
                                showToast('Failed to upload image. Please try again.', 'error')
                                logError('Error uploading image:', error)
                              } finally {
                                setUploadingImage(false)
                                // Reset file input
                                e.target.value = ''
                              }
                            }}
                            disabled={uploadingImage}
                          />
                        </label>
                      </div>
                    </div>

                    {formData.image_url && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Background Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.background_color || '#ffffff'}
                            onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formData.background_color || '#ffffff'}
                            onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                            placeholder="#FFFFFF"
                            className="flex-1 text-sm border rounded px-3 py-2"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Used when image doesn't fill the container</p>
                      </div>
                    )}

                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.rsvp_enabled}
                          onChange={(e) => setFormData({ ...formData, rsvp_enabled: e.target.checked })}
                          className="w-4 h-4 text-eco-green border-gray-300 rounded focus:ring-eco-green"
                        />
                        <span className="text-sm text-gray-700">RSVP Enabled</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_public_visible}
                          onChange={(e) => setFormData({ ...formData, is_public_visible: e.target.checked })}
                          className="w-4 h-4 text-eco-green border-gray-300 rounded focus:ring-eco-green"
                        />
                        <span className="text-sm text-gray-700">Publicly Visible</span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowCreateModal(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-eco-green hover:bg-green-600 text-white" disabled={saving}>
                        {saving ? 'Saving...' : (editingSubEvent ? 'Save Changes' : 'Create Sub-Event')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex gap-2 mb-2">
            <Link href={`/host/events/${eventId}`}>
                <Button variant="outline" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                  ← Back to Event
                </Button>
            </Link>
              <Link href={`/host/events/${eventId}/design`}>
                <Button variant="outline" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                  Design Invitation
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-4">Sub-Events</h1>
            <p className="text-gray-600 mt-2">
              Manage sub-events for {event.title}
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-eco-green hover:bg-green-600 text-white inline-flex items-center justify-center rounded-md font-medium transition-colors px-4 py-2"
            type="button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Sub-Event
          </button>
        </div>

        {/* Event Structure Info */}
        {event.event_structure === 'ENVELOPE' && (
          <Card className="bg-blue-50 border-blue-200 mb-6">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-800">
                <strong>Event Structure:</strong> ENVELOPE | <strong>RSVP Mode:</strong> {event.rsvp_mode === 'PER_SUBEVENT' ? 'Per Sub-Event' : 'One Tap All'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sub-Events List */}
        {subEvents.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-600 mb-4">No sub-events yet. Create your first one!</p>
              <button
                onClick={handleCreate}
                className="bg-eco-green hover:bg-green-600 text-white inline-flex items-center justify-center rounded-md font-medium transition-colors px-4 py-2"
                type="button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Sub-Event
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subEvents.map((subEvent) => (
              <Card key={subEvent.id} className="bg-white">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{subEvent.title}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(subEvent)}
                        className="p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(subEvent.id)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formatDateTime(subEvent.start_at)}</span>
                    </div>
                    {subEvent.end_at && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Ends: {formatDateTime(subEvent.end_at)}</span>
                      </div>
                    )}
                    {subEvent.location && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{subEvent.location}</span>
                      </div>
                    )}
                    {subEvent.description && (() => {
                      const isExpanded = expandedDescriptions.has(subEvent.id)
                      // Ensure description is always a string
                      const description = typeof subEvent.description === 'string'
                        ? subEvent.description
                        : subEvent.description
                          ? String(subEvent.description)
                          : ''
                      
                      if (!description) return null
                      
                      const isHTML = /<[a-z][\s\S]*>/i.test(description)
                      // Check if description is long enough to need truncation
                      const textContent = isHTML 
                        ? description.replace(/<[^>]*>/g, '').trim()
                        : description.trim()
                      const needsTruncation = textContent.length > 150 // Approximate 2 lines
                      
                      const truncationStyle = !isExpanded && needsTruncation ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        lineHeight: '1.5',
                        overflow: 'hidden' as const,
                      } : undefined
                      
                      return (
                        <div>
                          {isHTML ? (
                            <div 
                              className="text-sm text-gray-700 prose prose-sm max-w-none break-words"
                              style={truncationStyle}
                              dangerouslySetInnerHTML={{ __html: description }}
                            />
                          ) : (
                            <div 
                              className="text-sm text-gray-700 prose prose-sm max-w-none break-words"
                              style={truncationStyle}
                            >
                              {description}
                            </div>
                          )}
                          {needsTruncation && (
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedDescriptions)
                                if (isExpanded) {
                                  newExpanded.delete(subEvent.id)
                                } else {
                                  newExpanded.add(subEvent.id)
                                }
                                setExpandedDescriptions(newExpanded)
                              }}
                              className="text-xs text-eco-green hover:text-green-600 mt-1 font-medium"
                            >
                              {isExpanded ? 'View less' : 'View more'}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                    <div className="flex gap-2 pt-2 border-t">
                      <span className={`text-xs px-2 py-1 rounded ${
                        subEvent.rsvp_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        RSVP {subEvent.rsvp_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                        subEvent.is_public_visible ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {subEvent.is_public_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {subEvent.is_public_visible ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            onClick={(e) => {
              // Close modal when clicking backdrop
              if (e.target === e.currentTarget) {
                setShowCreateModal(false)
              }
            }}
          >
            <Card 
              className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{editingSubEvent ? 'Edit Sub-Event' : 'Create Sub-Event'}</CardTitle>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
                    type="button"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                      placeholder="e.g., Haldi, Mehndi, Sangeet, Wedding"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.start_at}
                        onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date & Time (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.end_at}
                        onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                      placeholder="Venue address"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDescriptionModalOpen(true)}
                        className="text-xs border-eco-green text-eco-green hover:bg-eco-green hover:text-white"
                      >
                        <Maximize2 className="h-3 w-3 mr-1" />
                        Full Screen Editor
                      </Button>
                    </div>
                    <RichTextEditor
                      value={formData.description || ''}
                      onChange={(value) => setFormData({ ...formData, description: value })}
                      placeholder="Enter sub-event description..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Use the toolbar to format text and add links. Click "Full Screen Editor" for a larger editing area.
                    </p>
                    <DescriptionEditorModal
                      isOpen={isDescriptionModalOpen}
                      onClose={() => setIsDescriptionModalOpen(false)}
                      value={formData.description || ''}
                      onChange={(value) => setFormData({ ...formData, description: value })}
                      placeholder="Enter sub-event description..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image
                    </label>
                    <div className="space-y-2">
                      {formData.image_url && (
                        <div className="relative w-full h-48 border border-gray-300 rounded-md overflow-hidden bg-gray-100">
                          <img
                            src={formData.image_url}
                            alt="Sub-event preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, image_url: '' })}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {uploadingImage ? (
                            <>
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eco-green mb-2"></div>
                              <p className="text-sm text-gray-600">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="text-sm text-gray-600">
                                <span className="font-semibold">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return

                            if (file.size > 5 * 1024 * 1024) {
                              showToast('Image must be less than 5MB', 'error')
                              return
                            }

                            if (!file.type.startsWith('image/')) {
                              showToast('Please upload an image file', 'error')
                              return
                            }

                            setUploadingImage(true)
                            try {
                              const imageUrl = await uploadImage(file, eventId)
                              // Update UI immediately with uploaded image
                              setFormData({ ...formData, image_url: imageUrl })
                              showToast('Image uploaded successfully', 'success')
                              
                              // Extract dominant color for background asynchronously (non-blocking)
                              extractDominantColors(imageUrl, 3)
                                .then((colors) => {
                                  const primaryColor = rgbToHex(colors[0] || 'rgb(0,0,0)')
                                  setFormData((prev) => ({
                                    ...prev,
                                    background_color: primaryColor,
                                  }))
                                })
                                .catch((error) => {
                                  console.error('Error extracting dominant colors (non-critical):', error)
                                  // Color extraction failed, but image is already uploaded and displayed
                                  // User can manually set background color if needed
                                })
                            } catch (error: any) {
                              showToast('Failed to upload image. Please try again.', 'error')
                              logError('Error uploading image:', error)
                            } finally {
                              setUploadingImage(false)
                              // Reset file input
                              e.target.value = ''
                            }
                          }}
                          disabled={uploadingImage}
                        />
                      </label>
                    </div>
                  </div>

                  {formData.image_url && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Background Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.background_color || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                          className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.background_color || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                          placeholder="#FFFFFF"
                          className="flex-1 text-sm border rounded px-3 py-2"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Used when image doesn't fill the container</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.rsvp_enabled}
                        onChange={(e) => setFormData({ ...formData, rsvp_enabled: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">RSVP Enabled</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_public_visible}
                        onChange={(e) => setFormData({ ...formData, is_public_visible: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Publicly Visible</span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-eco-green hover:bg-green-600 text-white"
                    >
                      {saving ? 'Saving...' : editingSubEvent ? 'Update' : 'Create'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateModal(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

