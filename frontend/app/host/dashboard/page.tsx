'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { logError } from '@/lib/error-handler'

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
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydration check - only run auth checks after hydration completes
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Wait for token to be available (handles race condition after login)
  useEffect(() => {
    // Only run after hydration completes
    if (!isHydrated) return

    const checkAuthAndFetch = async () => {
      let attempts = 0
      const maxAttempts = 20 // Wait up to 1 second (20 * 50ms)
      
      while (attempts < maxAttempts) {
    const token = localStorage.getItem('access_token')
        if (token) {
          // Token found, proceed with data fetching
          try {
            await Promise.all([
              fetchEvents(),
              fetchImpact()
            ])
          } catch (error: any) {
            // Handle errors
            if (error.response?.status === 401) {
              setLoading(false) // Clear loading before redirect
              router.push('/host/login')
            }
          }
          return
        }
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 50))
        attempts++
      }
      
      // No token found after waiting, redirect to login
      setLoading(false) // Ensure loading state is cleared
      router.push('/host/login')
    }
    
    checkAuthAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  useEffect(() => {
    // Auto-select all expired events when impact data loads
    if (impact && impact.events.length > 0) {
      setSelectedEventIds(new Set(impact.events.map(e => e.event_id)))
    }
  }, [impact])

  const fetchEvents = async () => {
    // Double-check auth before making request
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false) // CRITICAL: Clear loading state before redirect
      router.push('/host/login')
      return
    }
    
    try {
      const response = await api.get('/api/events/')
      setEvents(response.data.results || response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        setLoading(false) // Clear loading before redirect
        router.push('/host/login')
      } else {
        showToast('Failed to load events', 'error')
        setLoading(false) // Always clear loading on error
      }
    } finally {
      setLoading(false) // Always clear loading
    }
  }

  const fetchImpact = async () => {
    // Double-check auth before making request
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoadingImpact(false)
      return
    }
    
    setLoadingImpact(true)
    try {
      const response = await api.get('/api/events/impact/overall/')
      setImpact(response.data)
    } catch (error: any) {
      if (error.response?.status !== 401) {
        // Silently fail - impact is optional
        logError('Failed to load impact data:', error)
      }
    } finally {
      setLoadingImpact(false) // Always clear loading
    }
  }

  const handleExtendExpiry = async (eventId: number) => {
    // Navigate to event detail page where they can extend expiry
    router.push(`/host/events/${eventId}`)
  }

  const handleManageEvent = async (eventId: number) => {
    try {
      // Verify event ID
      if (!eventId || isNaN(Number(eventId))) {
        console.error('[Dashboard] Invalid event ID:', eventId)
        showToast('Invalid event ID', 'error')
        return
      }
      
      // Verify authentication
      const token = localStorage.getItem('access_token')
      if (!token) {
        showToast('Please log in again', 'error')
        router.push('/host/login')
        return
      }
      
      // Navigate with explicit refresh
      const url = `/host/events/${eventId}`
      router.push(url)
      
      // Force router refresh to clear cache
      setTimeout(() => {
        router.refresh()
      }, 50)
    } catch (error) {
      console.error('[Dashboard] Error navigating to event:', error)
      // Fallback: use window.location for hard navigation
      if (typeof window !== 'undefined') {
        window.location.href = `/host/events/${eventId}`
      }
    }
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
      <div className="container mx-auto px-4 py-8 md:py-10">
        {/* Welcome Section */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-eco-green md:text-4xl">Welcome Back</h1>
            <p className="text-lg text-gray-700">
              Keep the important things in view and jump into event tasks quickly.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/host/events/new">
              <Button className="bg-eco-green hover:bg-green-600 text-white">
                + Create Event
              </Button>
            </Link>
            <Link href="/host/profile">
              <Button variant="outline" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                Profile
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-lg text-gray-700">
            Manage your events and track sustainable outcomes without dashboard noise.
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
            <CardContent className="pt-6">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-eco-green">Sustainability Impact</h3>
                      <p className="text-sm text-gray-600">
                        Expand to filter expired events and view environmental metrics.
                      </p>
                    </div>
                    <span className="text-xs font-medium rounded-full bg-eco-green-light text-eco-green px-3 py-1 w-fit">
                      {impact.expired_events_count} expired event{impact.expired_events_count > 1 ? 's' : ''}
                    </span>
                  </div>
                </summary>
                <div className="mt-4 space-y-4">
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
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Events Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-eco-green">Active Events</h2>
          <Link href="/host/events/new">
            <Button className="bg-eco-green hover:bg-green-600 text-white">
              + New Event
            </Button>
          </Link>
        </div>

        {activeEvents.length === 0 ? (
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
            {activeEvents.map((event) => {
              return (
                <Card
                  key={event.id}
                  className="bg-white border-2 border-eco-green-light hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl text-eco-green">
                        {event.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="capitalize">{event.event_type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {event.date && (
                        <p className="text-sm flex items-center gap-2 text-gray-700">
                          <span>📅</span>
                          {new Date(event.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                      {event.expiry_date && event.expiry_date !== event.date && (
                        <p className="text-xs flex items-center gap-2 text-gray-600">
                          <span>⏰</span>
                          Expires: {new Date(event.expiry_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                      {event.city && (
                        <p className="text-sm flex items-center gap-2 text-gray-700">
                          <span>📍</span>
                          {event.city}
                        </p>
                      )}
                      <p className="text-sm flex items-center gap-2 text-gray-700">
                        <span>{event.is_public ? '🌐' : '🔒'}</span>
                        {event.is_public ? 'Public Registry' : 'Private Registry'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleManageEvent(event.id)}
                        className="w-full flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                      >
                        Manage
                      </Button>
                      <Link
                        href={`/invite/${event.slug}`}
                        target="_blank"
                        className="flex-1"
                      >
                        <Button className="w-full bg-eco-green hover:bg-green-600 text-white">
                          View Invitation
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {expiredEvents.length > 0 && (
          <Card className="mt-8 bg-white border-2 border-gray-300">
            <CardContent className="pt-6">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-700">Expired Events</h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {expiredEvents.length}
                    </span>
                  </div>
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expiredEvents.map((event) => (
                    <Card key={event.id} className="bg-white border border-gray-300">
                      <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-700">{event.title}</p>
                          <span className="text-xs font-medium rounded bg-gray-200 px-2 py-1 text-gray-700">
                            Expired
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 capitalize">{event.event_type}</p>
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleManageEvent(event.id)}
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            Open
                          </Button>
                          <Button
                            onClick={() => handleExtendExpiry(event.id)}
                            className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                          >
                            Extend
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
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
