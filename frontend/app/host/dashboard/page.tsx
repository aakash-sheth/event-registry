'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface Event {
  id: number
  slug: string
  title: string
  event_type: string
  date: string
  expiry_date?: string | null
  is_expired?: boolean
  city: string
  is_public: boolean
}

interface ImpactData {
  total_plates_saved: number
  total_paper_saved: number
  total_gifts_received: number
  total_gift_value_rupees: number
  total_paper_saved_on_gifts: number
  expired_events_count: number
  events: Array<{
    event_id: number
    event_title: string
    event_date: string | null
    expiry_date: string | null
    impact: any
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [impact, setImpact] = useState<ImpactData | null>(null)
  const [loadingImpact, setLoadingImpact] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    checkAuth()
    fetchEvents()
    fetchImpact()
  }, [])

  useEffect(() => {
    // Auto-select all expired events when impact data loads
    if (impact && impact.events.length > 0) {
      setSelectedEventIds(new Set(impact.events.map(e => e.event_id)))
    }
  }, [impact])

  const checkAuth = () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/host/login')
    }
  }

  const fetchEvents = async () => {
    try {
      const response = await api.get('/api/events/')
      setEvents(response.data.results || response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else {
        showToast('Failed to load events', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchImpact = async () => {
    setLoadingImpact(true)
    try {
      const response = await api.get('/api/events/impact/overall/')
      setImpact(response.data)
    } catch (error: any) {
      if (error.response?.status !== 401) {
        // Silently fail - impact is optional
        console.error('Failed to load impact data:', error)
      }
    } finally {
      setLoadingImpact(false)
    }
  }

  const handleExtendExpiry = async (eventId: number) => {
    // Navigate to event detail page where they can extend expiry
    router.push(`/host/events/${eventId}`)
  }

  const toggleEventSelection = (eventId: number) => {
    const newSelection = new Set(selectedEventIds)
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId)
    } else {
      newSelection.add(eventId)
    }
    setSelectedEventIds(newSelection)
  }

  const selectAllEvents = () => {
    if (impact && impact.events.length > 0) {
      setSelectedEventIds(new Set(impact.events.map(e => e.event_id)))
    }
  }

  const deselectAllEvents = () => {
    setSelectedEventIds(new Set())
  }

  // Calculate filtered impact
  const getFilteredImpact = () => {
    if (!impact || selectedEventIds.size === 0) {
      return {
        plates_saved: 0,
        paper_saved: 0,
        gifts_received: 0,
        gift_value_rupees: 0,
        paper_saved_on_gifts: 0,
      }
    }

    const selectedEvents = impact.events.filter(e => selectedEventIds.has(e.event_id))
    return {
      plates_saved: selectedEvents.reduce((sum, e) => sum + (e.impact?.food_saved?.plates_saved || 0), 0),
      paper_saved: selectedEvents.reduce((sum, e) => sum + (e.impact?.paper_saved?.web_rsvps || 0), 0),
      gifts_received: selectedEvents.reduce((sum, e) => sum + (e.impact?.gifts_received?.total_gifts || 0), 0),
      gift_value_rupees: selectedEvents.reduce((sum, e) => sum + (e.impact?.gifts_received?.total_value_rupees || 0), 0),
      paper_saved_on_gifts: selectedEvents.reduce((sum, e) => sum + (e.impact?.paper_saved_on_gifts?.cash_gifts || 0), 0),
    }
  }

  const filteredImpact = getFilteredImpact()
  const activeEvents = events.filter(e => !e.is_expired)
  const expiredEvents = events.filter(e => e.is_expired)

  if (loading) {
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
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="text-xl font-bold text-eco-green">CelebrateMindfully</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/host/events/new">
              <Button className="bg-eco-green hover:bg-green-600 text-white">
                + Create Event
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                router.push('/host/login')
              }}
              className="text-eco-green"
            >
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-eco-green">Welcome Back 🌿</h1>
          <p className="text-lg text-gray-700">
            Manage your events and track your sustainable celebrations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Active Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-eco-green">{activeEvents.length}</p>
              <CardDescription>Currently active events</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Expired Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-500">
                {expiredEvents.length}
              </p>
              <CardDescription>Events that have passed</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Public Registries</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-eco-green">
                {events.filter(e => e.is_public).length}
              </p>
              <CardDescription>Live and accessible</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Impact Section */}
        {impact && impact.expired_events_count > 0 && (
          <Card className="bg-white border-2 border-eco-green-light mb-8">
            <CardHeader>
              <CardTitle className="text-eco-green">🌱 Sustainability Impact</CardTitle>
              <CardDescription>
                Track your positive environmental impact from expired events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Event Filters */}
              {impact.events.length > 0 && (
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Select events to view impact:
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllEvents}
                        className="text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAllEvents}
                        className="text-xs"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {impact.events.map((eventImpact) => (
                      <label
                        key={eventImpact.event_id}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEventIds.has(eventImpact.event_id)}
                          onChange={() => toggleEventSelection(eventImpact.event_id)}
                          className="form-checkbox text-eco-green"
                        />
                        <span className="flex-1">{eventImpact.event_title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl mb-1">🍽️</div>
                  <p className="text-2xl font-bold text-eco-green">{filteredImpact.plates_saved}</p>
                  <p className="text-xs text-gray-600">Plates Saved</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">📄</div>
                  <p className="text-2xl font-bold text-eco-green">{filteredImpact.paper_saved}</p>
                  <p className="text-xs text-gray-600">Paper Saved</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">🎁</div>
                  <p className="text-2xl font-bold text-eco-green">{filteredImpact.gifts_received}</p>
                  <p className="text-xs text-gray-600">Gifts Received</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">💰</div>
                  <p className="text-2xl font-bold text-eco-green">
                    ₹{filteredImpact.gift_value_rupees.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-600">Gift Value</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">💳</div>
                  <p className="text-2xl font-bold text-eco-green">{filteredImpact.paper_saved_on_gifts}</p>
                  <p className="text-xs text-gray-600">Cash Gifts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-eco-green">Your Events</h2>
          <Link href="/host/events/new">
            <Button className="bg-eco-green hover:bg-green-600 text-white">
              + New Event
            </Button>
          </Link>
        </div>

        {events.length === 0 ? (
          <Card className="bg-white border-2 border-eco-green-light">
            <CardContent className="text-center py-16">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold mb-2 text-eco-green">No events yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first event to start planning sustainable celebrations
              </p>
              <Link href="/host/events/new">
                <Button className="bg-eco-green hover:bg-green-600 text-white px-8 py-6 text-lg">
                  Create Your First Event →
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const isExpired = event.is_expired || false
              return (
                <Card
                  key={event.id}
                  className={`bg-white border-2 transition-shadow ${
                    isExpired
                      ? 'border-gray-300 opacity-60'
                      : 'border-eco-green-light hover:shadow-lg'
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className={`text-xl ${
                          isExpired ? 'text-gray-500' : 'text-eco-green'
                        }`}
                      >
                        {event.title}
                      </CardTitle>
                      {isExpired && (
                        <span className="px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded">
                          Expired
                        </span>
                      )}
                    </div>
                    <CardDescription className="capitalize">{event.event_type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {event.date && (
                        <p className={`text-sm flex items-center gap-2 ${
                          isExpired ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          <span>📅</span>
                          {new Date(event.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                      {event.expiry_date && event.expiry_date !== event.date && (
                        <p className={`text-xs flex items-center gap-2 ${
                          isExpired ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <span>⏰</span>
                          Expires: {new Date(event.expiry_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                      {event.city && (
                        <p className={`text-sm flex items-center gap-2 ${
                          isExpired ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          <span>📍</span>
                          {event.city}
                        </p>
                      )}
                      <p className={`text-sm flex items-center gap-2 ${
                        isExpired ? 'text-gray-500' : 'text-gray-700'
                      }`}>
                        <span>{event.is_public ? '🌐' : '🔒'}</span>
                        {event.is_public ? 'Public Registry' : 'Private Registry'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/host/events/${event.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          className={`w-full ${
                            isExpired
                              ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                              : 'border-eco-green text-eco-green hover:bg-eco-green-light'
                          }`}
                        >
                          Manage
                        </Button>
                      </Link>
                      {isExpired && (
                        <Button
                          onClick={() => handleExtendExpiry(event.id)}
                          className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                        >
                          Extend Expiry
                        </Button>
                      )}
                      {!isExpired && event.is_public && (
                        <Link
                          href={`/registry/${event.slug}`}
                          target="_blank"
                          className="flex-1"
                        >
                          <Button className="w-full bg-eco-green hover:bg-green-600 text-white">
                            View Public
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Sustainability Message */}
        {events.length > 0 && (
          <Card className="mt-8 bg-eco-green-light border-2 border-eco-green">
            <CardContent className="py-6 text-center">
              <p className="text-lg text-gray-700">
                🌱 <strong>Every event you create helps reduce waste and make celebrations more meaningful.</strong>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Track RSVPs accurately, avoid duplicate gifts, and celebrate sustainably.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
