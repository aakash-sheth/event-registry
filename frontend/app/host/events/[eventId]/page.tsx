'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { generateWhatsAppShareLink, generateEventMessage, openWhatsApp, replaceTemplateVariables } from '@/lib/whatsapp'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import { WhatsAppTemplate, incrementWhatsAppTemplateUsage } from '@/lib/api'
import { getInvitePage } from '@/lib/invite/api'

const QRCode = dynamic(() => import('react-qr-code'), {
  ssr: false,
  loading: () => <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded" />
})

const TemplateSelector = dynamic(() => import('@/components/communications/TemplateSelector'), {
  ssr: false,
  loading: () => null
})

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
  has_rsvp: boolean
  has_registry: boolean
  whatsapp_message_template?: string
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  rsvp_mode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  host_name?: string
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
  const [invitePage, setInvitePage] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [rsvps, setRsvps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingPrivacyChange, setPendingPrivacyChange] = useState<boolean | null>(null)
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false)
  const [showExpiryEditor, setShowExpiryEditor] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [savingExpiry, setSavingExpiry] = useState(false)
  const [impact, setImpact] = useState<any>(null)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)

  useEffect(() => {
    if (!eventId || eventId === 'undefined') {
      logError('Invalid eventId:', eventId)
      showToast('Invalid event ID', 'error')
      router.push('/host/dashboard')
      return
    }
    fetchEvent()
    fetchInvitePage()
    fetchOrders()
    fetchGuests()
    fetchRsvps()
  }, [eventId, router])

  useEffect(() => {
    if (event && showExpiryEditor) {
      setExpiryDate(event.expiry_date || event.date || '')
    }
  }, [event, showExpiryEditor])

  useEffect(() => {
    // Fetch impact if event is expired
    if (event && event.is_expired) {
      fetchImpact()
    }
  }, [event])

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
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        // 403: Permission denied (not owner) or 404: Event not found
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
        logError('Failed to fetch event:', error)
        showToast(getErrorMessage(error), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchInvitePage = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const invite = await getInvitePage(parseInt(eventId))
      setInvitePage(invite)
    } catch (error: any) {
      // 404 is expected if invite page doesn't exist yet - that's okay
      if (error.response?.status !== 404) {
        logError('Failed to fetch invite page:', error)
      }
      setInvitePage(null)
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
      logError('Failed to fetch orders:', error)
    }
  }

  const fetchGuests = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/guests/`)
      // Handle both old format (array) and new format (object with guests and other_guests)
      if (Array.isArray(response.data)) {
        setGuests(response.data)
      } else {
        setGuests(response.data?.guests || [])
      }
    } catch (error) {
      // Guest list might not exist yet, that's okay
      logDebug('No guest list found')
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
      logDebug('No RSVPs found')
    }
  }

  const fetchImpact = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/impact/`)
      setImpact(response.data)
    } catch (error: any) {
      // Silently fail - impact is optional
      logError('Failed to fetch impact:', error)
    }
  }

  const handleSaveExpiry = async () => {
    if (!eventId || eventId === 'undefined' || !event) {
      return
    }
    setSavingExpiry(true)
    try {
      await api.patch(`/api/events/${eventId}/`, {
        expiry_date: expiryDate || null,
      })
      showToast('Expiry date updated successfully', 'success')
      setShowExpiryEditor(false)
      fetchEvent()
    } catch (error: any) {
      showToast('Failed to update expiry date', 'error')
    } finally {
      setSavingExpiry(false)
    }
  }

  const handlePrivacyToggle = (newValue: boolean) => {
    setPendingPrivacyChange(newValue)
    setShowPrivacyModal(true)
  }

  const confirmPrivacyChange = async () => {
    if (pendingPrivacyChange === null || !event) return
    
    try {
      await api.patch(`/api/events/${eventId}/`, {
        is_public: pendingPrivacyChange,
      })
      showToast(
        pendingPrivacyChange 
          ? 'Event is now public. Anyone with the link can RSVP and purchase gifts.' 
          : 'Event is now private. Only invited guests can RSVP and purchase gifts.',
        'success'
      )
      fetchEvent()
      setShowPrivacyModal(false)
      setPendingPrivacyChange(null)
    } catch (error: any) {
      showToast('Failed to update event privacy setting', 'error')
      setShowPrivacyModal(false)
      setPendingPrivacyChange(null)
    }
  }

  const getEventUrl = () => {
    if (typeof window === 'undefined' || !event) return ''
    return `${window.location.origin}/invite/${event.slug}`
  }

  const getRSVPUrl = () => {
    if (typeof window === 'undefined' || !event) return ''
    return `${window.location.origin}/event/${event.slug}/rsvp`
  }

  const getQRCodeUrl = () => {
    // QR code should link to RSVP page with source=qr parameter
    return `${getRSVPUrl()}?source=qr`
  }

  const handleShareWhatsApp = () => {
    if (!event) return
    setShowTemplateSelector(true)
  }

  const handleTemplateSelected = async (template: WhatsAppTemplate | null) => {
    if (!event) return
    
    setShowTemplateSelector(false)
    setSharingWhatsApp(true)
    
    try {
      const eventUrl = getEventUrl()
      let message: string
      
      if (template) {
        // Use selected template
        const result = replaceTemplateVariables(template.template_text, {
          name: '', // No guest name for general message
          event_title: event.title,
          event_date: event.date,
          event_location: event.city || '',
          event_url: eventUrl,
          host_name: event.host_name || undefined,
        })
        message = result.message
        
        // Increment usage count
        try {
          await incrementWhatsAppTemplateUsage(template.id)
        } catch (error) {
          // Silently fail - usage tracking is not critical
          logError('Failed to increment template usage:', error)
        }
      } else {
        // Use event default template
        message = generateEventMessage(
          event.title,
          event.date,
          eventUrl,
          event.host_name,
          (event as any).whatsapp_message_template
        )
      }
      
      const whatsappUrl = generateWhatsAppShareLink(message)
      openWhatsApp(whatsappUrl)
      showToast('Opening WhatsApp...', 'success')
    } catch (error: any) {
      logError('Failed to share on WhatsApp:', error)
      showToast('Failed to open WhatsApp', 'error')
    } finally {
      setSharingWhatsApp(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      const url = getEventUrl()
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showToast('URL copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast('Failed to copy URL', 'error')
    }
  }

  const handleDownloadQRCode = () => {
    try {
      const container = document.getElementById('qr-code-container')
      if (!container) {
        showToast('QR code not found', 'error')
        return
      }

      const svg = container.querySelector('svg')
      if (!svg) {
        showToast('QR code SVG not found', 'error')
        return
      }

      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        canvas.width = img.width + 40 // Add padding
        canvas.height = img.height + 40
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 20, 20)
        }
        const pngFile = canvas.toDataURL('image/png')
        const downloadLink = document.createElement('a')
        downloadLink.download = `qr-code-${event?.slug || eventId}.png`
        downloadLink.href = pngFile
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        showToast('QR code downloaded!', 'success')
      }

      img.onerror = () => {
        showToast('Failed to generate QR code image', 'error')
      }

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.src = url
    } catch (error) {
      logError('Error downloading QR code:', error)
      showToast('Failed to download QR code', 'error')
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
    .reduce((sum, o) => sum + o.amount_inr, 0);
  
  // Calculate comprehensive guest list stats
  // Filter out removed guests and RSVPs for stats
  const activeGuests = guests.filter(g => !g.is_removed);
  const activeRSVPs = rsvps.filter(r => !r.is_removed);
  
  const totalGuests = activeGuests.length;
  const totalRSVPs = activeRSVPs.length;
  
  // RSVP breakdown by status (exclude removed)
  const rsvpsYes = activeRSVPs.filter(r => r.will_attend === 'yes');
  const rsvpsNo = activeRSVPs.filter(r => r.will_attend === 'no');
  const rsvpsMaybe = activeRSVPs.filter(r => r.will_attend === 'maybe');
  
  // Attendance estimates (using guests_count from RSVPs)
  const confirmedAttendees = rsvpsYes.reduce((sum, r) => sum + (r.guests_count || 1), 0);
  const maybeAttendees = rsvpsMaybe.reduce((sum, r) => sum + (r.guests_count || 1), 0);
  const totalExpectedAttendees = confirmedAttendees + maybeAttendees;
  
  // Guest list coverage (exclude removed)
  const coreGuestsWithRSVP = activeRSVPs.filter(r => r.is_core_guest || r.guest_id).length;
  const coreGuestsPending = totalGuests - coreGuestsWithRSVP;
  const otherGuestsRSVP = activeRSVPs.filter(r => !r.is_core_guest && !r.guest_id).length;
  
  // Confirmed count from invited guests (core guests who said yes, exclude removed)
  const coreGuestsConfirmed = activeRSVPs.filter(r => (r.is_core_guest || r.guest_id) && r.will_attend === 'yes').length;
  
  // Response rate
  const responseRate = totalGuests > 0 ? Math.round((coreGuestsWithRSVP / totalGuests) * 100) : 0;
  
  // Gift stats (exclude removed guests)
  const paidOrders = orders.filter((o) => o.status === 'paid');
  const coreGuestsWithGifts = paidOrders.filter((o) => {
    return activeGuests.some((g) => {
      return (
        (o.buyer_phone && g.phone && o.buyer_phone === g.phone) ||
        (o.buyer_email && g.email && o.buyer_email === g.email)
      );
    });
  }).length;

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/host/dashboard">
            <Button variant="outline" className="mb-4 border-eco-green text-eco-green hover:bg-eco-green-light">
              ← Back to Dashboard
            </Button>
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-eco-green">{event.title}</h1>
              <p className="text-lg text-gray-700">
                <span className="capitalize">{event.event_type}</span> • {event.city || 'No location'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className={
          (totalGuests > 0 || totalRSVPs > 0) && (event?.has_registry && !event?.is_expired)
            ? 'grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8'
            : (totalGuests > 0 || totalRSVPs > 0) || (event?.has_registry && !event?.is_expired)
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'
            : 'grid grid-cols-1 gap-6 mb-8'
        }>
          {/* Show Impact Stats if expired, otherwise show Total Gifts */}
          {event.is_expired && impact ? (
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">🌱 Sustainability Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl mb-1">🍽️</div>
                    <p className="text-2xl font-bold text-eco-green">{impact.food_saved?.plates_saved || 0}</p>
                    <p className="text-xs text-gray-600">Plates Saved</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">📄</div>
                    <p className="text-2xl font-bold text-eco-green">{impact.paper_saved?.web_rsvps || 0}</p>
                    <p className="text-xs text-gray-600">Paper Saved</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎁</div>
                    <p className="text-2xl font-bold text-eco-green">{impact.gifts_received?.total_gifts || 0}</p>
                    <p className="text-xs text-gray-600">Gifts Received</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">💰</div>
                    <p className="text-xl font-bold text-eco-green">
                      ₹{((impact.gifts_received?.total_value_rupees || 0)).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-600">Gift Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            event?.has_registry && (
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
            )
          )}

          {/* Show card if there are guests OR RSVPs */}
          {(totalGuests > 0 || totalRSVPs > 0) && (
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">
                  {totalGuests > 0 ? 'Guest List Stats' : 'RSVP Stats'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Primary Stat: Expected Attendance */}
                <div className="mb-6 pb-4 border-b">
                  <p className="text-4xl font-bold text-eco-green mb-1">
                    {totalExpectedAttendees > 0 ? totalExpectedAttendees : '—'}
                  </p>
                  <p className="text-sm text-gray-500 font-medium">Expected attendance</p>
                </div>
                
                {/* Secondary Stats Grid */}
                <div className="space-y-4">
                  {/* Invited and Direct in a row */}
                  {(totalGuests > 0 || otherGuestsRSVP > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {totalGuests > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-500 text-xs font-medium mb-1.5 uppercase tracking-wide">From List</p>
                          <p className="text-lg font-semibold text-gray-700 mb-1">
                            <span className="text-eco-green">{coreGuestsConfirmed}</span>
                            <span className="text-gray-400 mx-1">confirmed</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            of {totalGuests} invited
                          </p>
                        </div>
                      )}
                      
                      {otherGuestsRSVP > 0 && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-blue-600 text-xs font-medium mb-1.5 uppercase tracking-wide">Direct</p>
                          <p className="text-2xl font-bold text-blue-700">{otherGuestsRSVP}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* RSVP Stats: YES | No | Maybe */}
                  {totalRSVPs > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wide">RSVP Breakdown</p>
                      <div className="flex gap-3">
                        <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-green-700 text-xs font-semibold mb-1 uppercase">Yes</p>
                          <p className="text-2xl font-bold text-green-700">{rsvpsYes.length}</p>
                        </div>
                        <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-red-700 text-xs font-semibold mb-1 uppercase">No</p>
                          <p className="text-2xl font-bold text-red-700">{rsvpsNo.length}</p>
                        </div>
                        <div className="flex-1 bg-yellow-50 rounded-lg p-3 text-center">
                          <p className="text-yellow-700 text-xs font-semibold mb-1 uppercase">Maybe</p>
                          <p className="text-2xl font-bold text-yellow-700">{rsvpsMaybe.length}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions Card */}
          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link href={`/host/events/${eventId}/design`}>
                  <Button className="w-full bg-eco-green hover:bg-green-600 text-white py-4 text-sm font-semibold">
                    Design Invitation Page
                  </Button>
                </Link>
                {event?.has_registry && (
                  <Link href={`/host/items/${eventId}`}>
                    <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light py-4 text-sm">
                      Manage Items
                    </Button>
                  </Link>
                )}
                <Link href={`/host/events/${eventId}/guests`}>
                  <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light py-4 text-sm">
                    Manage Guests
                  </Button>
                </Link>
                {event?.event_structure === 'ENVELOPE' && (
                  <Link href={`/host/events/${eventId}/sub-events`}>
                    <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light py-4 text-sm">
                      Manage Sub-Events
                    </Button>
                  </Link>
                )}
                <Link href={`/host/events/${eventId}/communications`}>
                  <Button variant="outline" className="w-full border-eco-green text-eco-green hover:bg-eco-green-light py-4 text-sm">
                    Communication Management
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Gifts Section */}
        {event?.has_registry && (
          <div className="mb-8">
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
        )}

        {/* Settings & Configuration Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-eco-green mb-4">Settings & Configuration</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Features */}
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Event Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Event Structure Toggle */}
                <div className="pb-3 border-b">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Structure
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="event_structure"
                        value="SIMPLE"
                        checked={event.event_structure === 'SIMPLE' || !event.event_structure}
                        onChange={async (e) => {
                          try {
                            await api.patch(`/api/events/${eventId}/`, {
                              event_structure: 'SIMPLE',
                            })
                            showToast('Event structure updated to Simple', 'success')
                            fetchEvent()
                          } catch (error: any) {
                            showToast('Failed to update event structure', 'error')
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Simple</div>
                        <p className="text-xs text-gray-500">
                          Single event without sub-events
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="event_structure"
                        value="ENVELOPE"
                        checked={event.event_structure === 'ENVELOPE'}
                        onChange={async (e) => {
                          try {
                            await api.patch(`/api/events/${eventId}/`, {
                              event_structure: 'ENVELOPE',
                            })
                            showToast('Event structure updated to Envelope', 'success')
                            fetchEvent()
                          } catch (error: any) {
                            showToast('Failed to update event structure', 'error')
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Envelope</div>
                        <p className="text-xs text-gray-500">
                          Event with multiple sub-events (e.g., Haldi, Mehndi, Wedding)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

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

                {/* Privacy Toggle */}
                <div className="pt-3 border-t">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex-1">
                      <span className="font-medium text-sm text-gray-700 block mb-1">
                        {event.is_public ? 'Public Event' : 'Private Event'}
                      </span>
                      <p className="text-xs text-gray-500">
                        {event.is_public 
                          ? 'Anyone with the link can RSVP and purchase gifts'
                          : 'Only invited guests can RSVP and purchase gifts'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={event.is_public}
                      onClick={() => handlePrivacyToggle(!event.is_public)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-eco-green focus:ring-offset-2 ${
                        event.is_public ? 'bg-eco-green' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          event.is_public ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Wrapper for conditional cards */}
            <div className="space-y-6">
              {/* ENVELOPE Mode Configuration */}
              {event.event_structure === 'ENVELOPE' && (
                <Card className="bg-white border-2 border-eco-green-light">
                <CardHeader>
                  <CardTitle className="text-eco-green">Event Envelope Settings</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure RSVP behavior for sub-events
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      RSVP Mode
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="rsvp_mode"
                          value="ONE_TAP_ALL"
                          checked={event.rsvp_mode === 'ONE_TAP_ALL'}
                          onChange={async (e) => {
                            try {
                              await api.patch(`/api/events/${eventId}/`, {
                                rsvp_mode: 'ONE_TAP_ALL',
                              })
                              showToast('RSVP mode updated to One Tap All', 'success')
                              fetchEvent()
                            } catch (error: any) {
                              showToast('Failed to update RSVP mode', 'error')
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">One Tap All</div>
                          <p className="text-xs text-gray-500">
                            Guests confirm attendance for all sub-events with a single Yes/No response
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="rsvp_mode"
                          value="PER_SUBEVENT"
                          checked={event.rsvp_mode === 'PER_SUBEVENT'}
                          onChange={async (e) => {
                            try {
                              await api.patch(`/api/events/${eventId}/`, {
                                rsvp_mode: 'PER_SUBEVENT',
                              })
                              showToast('RSVP mode updated to Per Sub-Event', 'success')
                              fetchEvent()
                            } catch (error: any) {
                              showToast('Failed to update RSVP mode', 'error')
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">Per Sub-Event</div>
                          <p className="text-xs text-gray-500">
                            Guests can select which specific sub-events they'll attend
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Event Expiry Management */}
            {event.is_expired && (
              <Card className="bg-white border-2 border-gray-300">
                <CardHeader>
                  <CardTitle className="text-gray-600">Event Expired</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    This event has passed its expiry date. You can extend it to reactivate.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!showExpiryEditor ? (
                    <>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-700">
                          <strong>Event Date:</strong> {event.date ? new Date(event.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }) : 'Not set'}
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                          <strong>Expiry Date:</strong> {event.expiry_date ? new Date(event.expiry_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }) : (event.date ? new Date(event.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }) : 'Not set')}
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowExpiryEditor(true)}
                        className="bg-eco-green hover:bg-green-600 text-white"
                      >
                        Extend Expiry Date
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">New Expiry Date</label>
                        <input
                          type="date"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500">
                          Set a future date to reactivate this event. Leave empty to use event date.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveExpiry}
                          disabled={savingExpiry}
                          className="bg-eco-green hover:bg-green-600 text-white"
                        >
                          {savingExpiry ? 'Saving...' : 'Save Expiry Date'}
                        </Button>
                        <Button
                          onClick={() => {
                            setExpiryDate(event.expiry_date || event.date || '')
                            setShowExpiryEditor(false)
                          }}
                          variant="outline"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Event URL & Sharing */}
            {/* Share link is always visible for hosts */}
            <Card className="bg-white border-2 border-eco-green-light">
                <CardHeader>
                  <CardTitle className="text-eco-green">Event URL & Sharing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Public Event Link</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getEventUrl()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                      />
                      <Button
                        onClick={handleCopyUrl}
                        variant="outline"
                        className="border-eco-green text-eco-green hover:bg-eco-green-light"
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={handleShareWhatsApp}
                      disabled={sharingWhatsApp}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      {sharingWhatsApp ? 'Opening...' : 'Share on WhatsApp'}
                    </Button>
                    
                    <Button
                      onClick={() => setShowQRCode(!showQRCode)}
                      variant="outline"
                      className="w-full border-eco-green text-eco-green hover:bg-eco-green-light"
                    >
                      {showQRCode ? 'Hide' : 'Show'} QR Code
                    </Button>

                    {showQRCode && (
                      <div className="flex flex-col items-center space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="bg-white p-4 rounded-lg" id="qr-code-container">
                          <QRCode
                            value={getQRCodeUrl()}
                            size={200}
                            level="H"
                            bgColor="#FFFFFF"
                            fgColor="#000000"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleDownloadQRCode}
                            className="bg-eco-green hover:bg-green-600 text-white"
                          >
                            Download QR Code
                          </Button>
                          <Link href={getEventUrl()} target="_blank">
                            <Button
                              variant="outline"
                              className="border-eco-green text-eco-green hover:bg-eco-green-light"
                            >
                              Open Link
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Confirmation Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-eco-green">
                {pendingPrivacyChange ? 'Make Event Public?' : 'Make Event Private?'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingPrivacyChange ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong className="text-green-600">Public Event:</strong> Anyone with the event URL or QR code can RSVP and purchase items from the registry, even if they're not on your guest list.
                  </p>
                  <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    ⚠️ This means people you haven't invited can still participate in your event.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong className="text-blue-600">Private Event:</strong> Only people in your guest list can RSVP and purchase items from the registry.
                  </p>
                  <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    ℹ️ People not on your guest list will be unable to RSVP or purchase gifts, even if they have the event link.
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPrivacyModal(false)
                    setPendingPrivacyChange(null)
                  }}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPrivacyChange}
                  className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && event && (
        <TemplateSelector
          eventId={parseInt(eventId)}
          eventTitle={event.title}
          eventDate={event.date}
          eventUrl={getEventUrl()}
          hostName={event.host_name}
          eventLocation={event.city}
          onSelect={handleTemplateSelected}
          onCancel={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  )
}

