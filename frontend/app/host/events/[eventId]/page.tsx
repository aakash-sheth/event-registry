'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  has_rsvp: boolean
  has_registry: boolean
}

interface Order {
  id: number
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  amount_inr: number
  status: string
  created_at: string
  item: {
    name: string
  } | null
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [rsvps, setRsvps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!eventId || eventId === 'undefined') {
      console.error('Invalid eventId:', eventId)
      showToast('Invalid event ID', 'error')
      router.push('/host/dashboard')
      return
    }
    fetchEvent()
    fetchOrders()
    fetchGuests()
    fetchRsvps()
  }, [eventId, router])

  const fetchEvent = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else {
        console.error('Failed to fetch event:', error)
        showToast('Failed to load event', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchOrders = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/orders/`)
      setOrders(response.data.results || response.data || [])
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    }
  }

  const fetchGuests = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/guests/`)
      setGuests(response.data || [])
    } catch (error) {
      // Guest list might not exist yet, that's okay
      console.log('No guest list found')
    }
  }

  const fetchRsvps = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/rsvps/`)
      setRsvps(response.data || [])
    } catch (error) {
      // RSVPs might not exist yet, that's okay
      console.log('No RSVPs found')
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/guests.csv/`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `guest_list_${event?.slug || eventId}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      showToast('Guest list exported successfully', 'success')
    } catch (error) {
      showToast('Failed to export CSV', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Loading...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Event not found</div>
      </div>
    )
  }

  const totalAmount = orders
    .filter((o) => o.status === 'paid')
    .reduce((sum, o) => sum + o.amount_inr, 0)
  
  // Calculate guest list stats
  const totalGuests = guests.length
  const coreGuestsWithRSVP = rsvps.filter(r => r.is_core_guest || r.guest_id).length
  const coreGuestsWithGifts = orders.filter(o => o.status === 'paid' && 
    guests.some(g => 
      (o.buyer_phone && g.phone && o.buyer_phone === g.phone) ||
      (o.buyer_email && g.email && o.buyer_email === g.email)
    )
  ).length
  const extendedGuests = rsvps.filter(r => !r.is_core_guest && !r.guest_id).length

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/host/dashboard">
            <Button variant="outline" className="mb-4 border-eco-green text-eco-green hover:bg-eco-green-light">
              ← Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2 text-eco-green">{event.title}</h1>
          <p className="text-lg text-gray-700">
            <span className="capitalize">{event.event_type}</span> • {event.city || 'No location'}
          </p>
        </div>

        <div className={`grid grid-cols-1 ${totalGuests > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 mb-8`}>
          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Total Gifts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-eco-green">
                ₹{(totalAmount / 100).toLocaleString('en-IN')}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {orders.filter((o) => o.status === 'paid').length} gifts received
              </p>
            </CardContent>
          </Card>

          {totalGuests > 0 && (
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Guest List Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-eco-green mb-2">{totalGuests}</p>
                <p className="text-sm text-gray-600">Total invited</p>
                <div className="mt-4 space-y-1 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">{coreGuestsWithGifts}</span> from list gave gifts
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">{coreGuestsWithRSVP}</span> from list RSVP'd
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/host/events/${eventId}/design`}>
                <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light">
                  🎨 Design Event Page
                </Button>
              </Link>
              <Link href={`/host/items/${eventId}`}>
                <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light">
                  Manage Items
                </Button>
              </Link>
              <Link href={`/host/events/${eventId}/guests`}>
                <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light">
                  Manage Guest List
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="w-full border-eco-green text-eco-green hover:bg-eco-green-light"
              >
                Export Guest List
              </Button>
            </CardContent>
          </Card>

          {/* Feature Toggles */}
          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Event Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">RSVP</span>
                    <p className="text-xs text-gray-500">Allow guests to confirm attendance</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={event.has_rsvp}
                    onChange={async (e) => {
                      try {
                        await api.patch(`/api/events/${eventId}/`, {
                          has_rsvp: e.target.checked,
                        })
                        showToast('RSVP setting updated', 'success')
                        fetchEvent()
                      } catch (error: any) {
                        showToast('Failed to update RSVP setting', 'error')
                      }
                    }}
                    className="form-checkbox text-eco-green"
                  />
                </label>
              </div>

              <div>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Gift Registry</span>
                    <p className="text-xs text-gray-500">Allow guests to purchase gifts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={event.has_registry}
                    onChange={async (e) => {
                      try {
                        await api.patch(`/api/events/${eventId}/`, {
                          has_registry: e.target.checked,
                        })
                        showToast('Registry setting updated', 'success')
                        fetchEvent()
                      } catch (error: any) {
                        showToast('Failed to update registry setting', 'error')
                      }
                    }}
                    className="form-checkbox text-eco-green"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          {event.is_public && (
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Public Registry</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/registry/${event.slug}`} target="_blank">
                  <Button className="w-full bg-eco-green hover:bg-green-600 text-white">View Public Page</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Recent Gifts</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No gifts received yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Gift Giver</th>
                      <th className="text-left p-2">Gift Item</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{order.buyer_name}</div>
                            <div className="text-sm text-gray-600">
                              {order.buyer_email}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          {order.item?.name || 'Cash Gift'}
                        </td>
                        <td className="p-2">
                          ₹{(order.amount_inr / 100).toLocaleString('en-IN')}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              order.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {order.status === 'paid' ? 'Received' : order.status}
                          </span>
                        </td>
                        <td className="p-2 text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

