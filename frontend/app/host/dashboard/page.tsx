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
  city: string
  is_public: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    fetchEvents()
  }, [])

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
              <p className="text-3xl font-bold text-eco-green">{events.length}</p>
              <CardDescription>Total events created</CardDescription>
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

          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Sustainability Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-eco-green">🌱</p>
              <CardDescription>Every event makes a difference</CardDescription>
            </CardContent>
          </Card>
        </div>

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
            {events.map((event) => (
              <Card key={event.id} className="bg-white border-2 border-eco-green-light hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-eco-green text-xl">{event.title}</CardTitle>
                  <CardDescription className="capitalize">{event.event_type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {event.date && (
                      <p className="text-sm text-gray-700 flex items-center gap-2">
                        <span>📅</span>
                        {new Date(event.date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                    {event.city && (
                      <p className="text-sm text-gray-700 flex items-center gap-2">
                        <span>📍</span>
                        {event.city}
                      </p>
                    )}
                    <p className="text-sm text-gray-700 flex items-center gap-2">
                      <span>{event.is_public ? '🌐' : '🔒'}</span>
                      {event.is_public ? 'Public Registry' : 'Private Registry'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/host/events/${event.id}`} className="flex-1">
                      <Button 
                        variant="outline" 
                        className="w-full border-eco-green text-eco-green hover:bg-eco-green-light"
                      >
                        Manage
                      </Button>
                    </Link>
                    {event.is_public && (
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
            ))}
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
