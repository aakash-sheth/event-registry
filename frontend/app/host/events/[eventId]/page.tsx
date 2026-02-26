'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api, { createAttributionLink, listAttributionLinks, getEventAnalyticsSummary, enableEventAnalyticsInsights, type AttributionLink, type EventAnalyticsSummary } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import { getInvitePage } from '@/lib/invite/api'
import QRCode from 'react-qr-code'
import { ChevronDown } from 'lucide-react'

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
  page_config?: Record<string, any>
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

type InvitePublishStatus = 'Published' | 'Draft' | 'Not created' | 'Unknown'
type LinkKey = 'invite' | 'rsvp' | 'registry'

const qrDestinationLabel: Record<LinkKey, string> = {
  invite: 'Invite Page',
  rsvp: 'RSVP Page',
  registry: 'Registry Page',
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
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingPrivacyChange, setPendingPrivacyChange] = useState<boolean | null>(null)
  const [showExpiryEditor, setShowExpiryEditor] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [savingExpiry, setSavingExpiry] = useState(false)
  const [impact, setImpact] = useState<any>(null)
  const [invitePublishStatus, setInvitePublishStatus] = useState<InvitePublishStatus>('Unknown')
  const [trackedLinks, setTrackedLinks] = useState<Record<LinkKey, AttributionLink | null>>({
    invite: null,
    rsvp: null,
    registry: null,
  })
  const [openQrKey, setOpenQrKey] = useState<LinkKey | null>(null)
  const [openActionsKey, setOpenActionsKey] = useState<LinkKey | null>(null)
  const [downloadPickerKey, setDownloadPickerKey] = useState<LinkKey | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<'professional' | 'raw'>('professional')
  const [analyticsSummary, setAnalyticsSummary] = useState<EventAnalyticsSummary | null>(null)
  const [enablingInsights, setEnablingInsights] = useState(false)

  useEffect(() => {
    if (!eventId || eventId === 'undefined') {
      logError('Invalid eventId:', eventId)
      showToast('Invalid event ID', 'error')
      router.push('/host/dashboard')
      return
    }
    fetchEvent()
    fetchOrders()
    fetchGuests()
    fetchRsvps()
  }, [eventId, router])

  useEffect(() => {
    if (!eventId || eventId === 'undefined') return
    loadTrackedLinks()
  }, [eventId, event?.has_rsvp, event?.has_registry])

  useEffect(() => {
    if (!eventId || eventId === 'undefined') return
    let cancelled = false
    getEventAnalyticsSummary(parseInt(eventId))
      .then((data) => { if (!cancelled) setAnalyticsSummary(data) })
      .catch(() => { if (!cancelled) setAnalyticsSummary(null) })
    return () => { cancelled = true }
  }, [eventId])

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

  useEffect(() => {
    let cancelled = false

    const loadInvitePublishStatus = async () => {
      if (!event || !eventId || eventId === 'undefined') return

      const hasConfig = !!(event.page_config && Object.keys(event.page_config).length > 0)
      if (!hasConfig) {
        if (!cancelled) setInvitePublishStatus('Not created')
        return
      }

      try {
        const invite = await getInvitePage(parseInt(eventId))
        if (cancelled) return
        if (!invite) {
          setInvitePublishStatus('Not created')
          return
        }
        setInvitePublishStatus(invite.is_published ? 'Published' : 'Draft')
      } catch {
        if (!cancelled) setInvitePublishStatus('Unknown')
      }
    }

    loadInvitePublishStatus()
    return () => {
      cancelled = true
    }
  }, [event, eventId])

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

  const getInviteUrl = () => {
    if (typeof window === 'undefined' || !event) return ''
    return `${window.location.origin}/invite/${event.slug}`
  }

  const getRSVPUrl = () => {
    if (typeof window === 'undefined' || !event) return ''
    return `${window.location.origin}/event/${event.slug}/rsvp`
  }

  const getRegistryUrl = () => {
    if (typeof window === 'undefined' || !event) return ''
    return `${window.location.origin}/registry/${event.slug}`
  }

  const campaignPreset: Record<LinkKey, string> = {
    invite: 'main_card',
    rsvp: 'rsvp_card',
    registry: 'registry_card',
  }

  const placementPreset: Record<LinkKey, string> = {
    invite: 'physical_invite',
    rsvp: 'physical_invite',
    registry: 'physical_invite',
  }

  const upsertTrackedLink = async (key: LinkKey, silent = false) => {
    if (!eventId || eventId === 'undefined') return null
    try {
      const created = await createAttributionLink(parseInt(eventId), {
        target_type: key,
        channel: 'qr',
        campaign: campaignPreset[key],
        placement: placementPreset[key],
      })
      if (!silent) {
        setTrackedLinks((prev) => ({ ...prev, [key]: created }))
      }
      return created
    } catch (error: any) {
      if (!silent) {
        showToast(getErrorMessage(error) || 'Unable to initialize tracked link', 'error')
      }
      return null
    }
  }

  const loadTrackedLinks = async () => {
    try {
      const links = await listAttributionLinks(parseInt(eventId))
      const latest: Record<LinkKey, AttributionLink | null> = { invite: null, rsvp: null, registry: null }
      links.forEach((link) => {
        const key = link.target_type as LinkKey
        if (!latest[key]) {
          latest[key] = link
        }
      })

      // Always-on tracking: silently provision canonical tracked links for enabled destinations.
      if (event) {
        const requiredKeys: LinkKey[] = ['invite']
        if (event.has_rsvp) requiredKeys.push('rsvp')
        if (event.has_registry) requiredKeys.push('registry')

        for (const key of requiredKeys) {
          if (!latest[key]) {
            const created = await upsertTrackedLink(key, true)
            if (created) latest[key] = created
          }
        }
      }

      setTrackedLinks(latest)
    } catch (error) {
      logDebug('Tracked links not available yet')
    }
  }

  const getTrackedUrl = (key: LinkKey) => trackedLinks[key]?.short_url || ''
  const getEffectiveUrl = (key: LinkKey, fallbackUrl: string) => getTrackedUrl(key) || fallbackUrl

  const escapeSvgText = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const truncateText = (value: string, maxLength: number) =>
    value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value

  const buildProfessionalQrSvg = (key: LinkKey, qrSvgElement: SVGSVGElement) => {
    const viewBox = qrSvgElement.getAttribute('viewBox') || ''
    const viewBoxParts = viewBox.split(/\s+/).map(Number)
    const qrViewBoxSize =
      viewBoxParts.length === 4 && Number.isFinite(viewBoxParts[2]) && viewBoxParts[2] > 0
        ? viewBoxParts[2]
        : 29
    const qrPathMarkup = qrSvgElement.innerHTML

    // A5 portrait print-friendly canvas (148mm x 210mm), 10 units per mm
    const canvasWidth = 1480
    const canvasHeight = 2100
    const cardX = 70
    const cardY = 70
    const cardWidth = canvasWidth - cardX * 2
    const cardHeight = canvasHeight - cardY * 2
    const qrFrameSize = 820
    const qrScale = qrFrameSize / qrViewBoxSize
    const qrTranslateX = (canvasWidth - qrFrameSize) / 2
    const qrTranslateY = 690

    const safeEventTitle = escapeSvgText(truncateText(event?.title?.trim() || 'Event Invitation', 58))
    const safeDestinationLabel = escapeSvgText(qrDestinationLabel[key])

    const badgeWidth = qrViewBoxSize * 0.42
    const badgeHeight = qrViewBoxSize * 0.11
    const badgeX = (qrViewBoxSize - badgeWidth) / 2
    const badgeY = (qrViewBoxSize - badgeHeight) / 2
    const badgeRadius = badgeHeight * 0.5
    const badgeInset = badgeHeight * 0.14
    const badgeInnerWidth = badgeWidth - badgeInset * 2
    const badgeInnerHeight = badgeHeight - badgeInset * 2
    const badgeInnerRadius = badgeRadius * 0.9
    const badgeFontSize = badgeInnerHeight * 0.55
    const brandBadgeMarkup = `
      <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" fill="#FFFFFF" stroke="#D7E6D2" stroke-width="${badgeHeight * 0.03}" />
      <text x="${qrViewBoxSize / 2}" y="${qrViewBoxSize / 2}" text-anchor="middle" dominant-baseline="central" font-size="${badgeFontSize}" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#2C6B3F">Ekfern</text>
    `

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="148mm" height="210mm" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="qrCardGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F5F8F1" />
    </linearGradient>
  </defs>
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#FFFFFF" />
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="36" fill="url(#qrCardGradient)" stroke="#CDE2C8" stroke-width="3" />
  <text x="${canvasWidth / 2}" y="260" text-anchor="middle" font-size="64" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#2C6B3F">${safeEventTitle}</text>
  <text x="${canvasWidth / 2}" y="340" text-anchor="middle" font-size="40" font-family="Inter, Arial, sans-serif" font-weight="600" fill="#3A8A4D">${safeDestinationLabel}</text>
  <text x="${canvasWidth / 2}" y="410" text-anchor="middle" font-size="28" font-family="Inter, Arial, sans-serif" fill="#5E6E63">Scan this QR code to open instantly</text>
  <rect x="${(canvasWidth - (qrFrameSize + 72)) / 2}" y="${qrTranslateY - 36}" width="${qrFrameSize + 72}" height="${qrFrameSize + 72}" rx="30" fill="#FFFFFF" stroke="#D7E6D2" stroke-width="2" />
  <g transform="translate(${qrTranslateX}, ${qrTranslateY}) scale(${qrScale})">
    ${qrPathMarkup}
    ${brandBadgeMarkup}
  </g>
  <text x="${canvasWidth / 2}" y="${qrTranslateY + qrFrameSize + 130}" text-anchor="middle" font-size="26" font-family="Inter, Arial, sans-serif" fill="#5E6E63">Built with Ekfern</text>
</svg>`
  }

  const buildRawBrandedQrSvg = (qrSvgElement: SVGSVGElement) => {
    const width = qrSvgElement.getAttribute('width') || '148'
    const height = qrSvgElement.getAttribute('height') || '148'
    const viewBox = qrSvgElement.getAttribute('viewBox') || '0 0 29 29'
    const viewBoxParts = viewBox.split(/\s+/).map(Number)
    const qrViewBoxSize =
      viewBoxParts.length === 4 && Number.isFinite(viewBoxParts[2]) && viewBoxParts[2] > 0
        ? viewBoxParts[2]
        : 29
    const qrPathMarkup = qrSvgElement.innerHTML

    const badgeWidth = qrViewBoxSize * 0.42
    const badgeHeight = qrViewBoxSize * 0.11
    const badgeX = (qrViewBoxSize - badgeWidth) / 2
    const badgeY = (qrViewBoxSize - badgeHeight) / 2
    const badgeRadius = badgeHeight * 0.5
    const badgeInset = badgeHeight * 0.14
    const badgeInnerWidth = badgeWidth - badgeInset * 2
    const badgeInnerHeight = badgeHeight - badgeInset * 2
    const badgeInnerRadius = badgeRadius * 0.9
    const badgeFontSize = badgeInnerHeight * 0.55

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
  ${qrPathMarkup}
  <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" fill="#FFFFFF" stroke="#D7E6D2" stroke-width="${badgeHeight * 0.03}" />
  <text x="${qrViewBoxSize / 2}" y="${qrViewBoxSize / 2}" text-anchor="middle" dominant-baseline="central" font-size="${badgeFontSize}" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#2C6B3F">Ekfern</text>
</svg>`
  }

  const downloadSvgBlob = (svgString: string, filename: string) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(blobUrl)
  }

  const handleDownloadProfessionalQr = (key: LinkKey) => {
    const wrapper = document.getElementById(`tracked-qr-${key}`)
    const svg = wrapper?.querySelector('svg')
    if (!svg) {
      showToast('QR preview not available yet', 'error')
      return
    }

    const svgString = buildProfessionalQrSvg(key, svg)
    if (!svgString) {
      showToast('Unable to generate QR download', 'error')
      return
    }
    downloadSvgBlob(svgString, `${event?.slug || 'event'}-${key}-qr-professional.svg`)
    showToast('Professional QR downloaded', 'success')
  }

  const handleDownloadRawQr = (key: LinkKey) => {
    const wrapper = document.getElementById(`tracked-qr-${key}`)
    const svg = wrapper?.querySelector('svg')
    if (!svg) {
      showToast('QR preview not available yet', 'error')
      return
    }
    const rawSvgString = buildRawBrandedQrSvg(svg)
    downloadSvgBlob(rawSvgString, `${event?.slug || 'event'}-${key}-qr-raw.svg`)
    showToast('Raw QR downloaded', 'success')
  }

  const handleDownloadWithFormat = (key: LinkKey) => {
    if (downloadFormat === 'professional') {
      handleDownloadProfessionalQr(key)
    } else {
      handleDownloadRawQr(key)
    }
    setDownloadPickerKey(null)
  }

  const handleCopyLink = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkKey(key)
      showToast('Link copied!', 'success')
      setTimeout(() => setCopiedLinkKey(null), 2000)
    } catch {
      showToast('Failed to copy link', 'error')
    }
  }

  const handleShareLink = async (label: string, url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${event?.title || 'Event'} - ${label}`,
          text: `Sharing ${label} for ${event?.title || 'event'}`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopiedLinkKey(label)
      showToast('Share not supported on this browser. Link copied instead.', 'info')
      setTimeout(() => setCopiedLinkKey(null), 2000)
    } catch (error) {
      showToast('Unable to share link', 'error')
    }
  }

  const handleEnableInsights = async () => {
    if (!eventId || eventId === 'undefined') return
    try {
      setEnablingInsights(true)
      await enableEventAnalyticsInsights(parseInt(eventId))
      const data = await getEventAnalyticsSummary(parseInt(eventId))
      setAnalyticsSummary(data)
      showToast('Tracking insights enabled. Click details are now visible.', 'success')
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Failed to enable tracking insights', 'error')
    } finally {
      setEnablingInsights(false)
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

  // In PER_SUBEVENT, /rsvps/ returns one row per sub-event, so stats must dedupe per guest.
  const isPerSubeventMode = event?.event_structure === 'ENVELOPE' && event?.rsvp_mode === 'PER_SUBEVENT';

  const normalizePhoneKey = (r: any): string => {
    const ccDigits = String(r?.country_code || '').replace(/\D/g, '') // "+91" -> "91"
    const localDigits = String(r?.local_number || '').replace(/\D/g, '')
    if (localDigits.length >= 10) {
      return `phone:${ccDigits}:${localDigits.slice(-10)}`
    }
    const phoneDigits = String(r?.phone || '').replace(/\D/g, '')
    if (phoneDigits.length >= 10) {
      return `phone:${ccDigits}:${phoneDigits.slice(-10)}`
    }
    if (phoneDigits) return `phone_raw:${ccDigits}:${phoneDigits}`
    return ''
  }

  const getAttendeeKey = (r: any) => {
    // Primary: unique RSVP submission per invited guest (event + guest_id)
    if (r?.guest_id) return `event:${eventId}:guest:${String(r.guest_id)}`
    const phoneKey = normalizePhoneKey(r)
    // Fallback: direct RSVPs may not have guest_id; dedupe by event + normalized phone
    if (phoneKey) return `event:${eventId}:${phoneKey}`
    return `event:${eventId}:rsvp:${String(r?.id ?? '')}`
  }

  // Compute an overall RSVP status per guest (priority: yes > maybe > no)
  const perGuest = new Map<
    string,
    {
      isCore: boolean
      hasYes: boolean
      hasMaybe: boolean
      hasNo: boolean
      maxYesCount: number
      maxMaybeCount: number
    }
  >();

  activeRSVPs.forEach((r) => {
    const key = getAttendeeKey(r);
    const entry =
      perGuest.get(key) || {
        isCore: false,
        hasYes: false,
        hasMaybe: false,
        hasNo: false,
        maxYesCount: 0,
        maxMaybeCount: 0,
      };

    entry.isCore = entry.isCore || !!(r.is_core_guest || r.guest_id);

    const status = r.will_attend;
    const count = r.guests_count || 1;
    if (status === 'yes') {
      entry.hasYes = true;
      entry.maxYesCount = Math.max(entry.maxYesCount, count);
    } else if (status === 'maybe') {
      entry.hasMaybe = true;
      entry.maxMaybeCount = Math.max(entry.maxMaybeCount, count);
    } else if (status === 'no') {
      entry.hasNo = true;
    }

    perGuest.set(key, entry);
  });

  // RSVP breakdown: use per-guest classification for PER_SUBEVENT; raw rows otherwise.
  const rsvpsYesCount = isPerSubeventMode
    ? Array.from(perGuest.values()).filter(v => v.hasYes).length
    : activeRSVPs.filter(r => r.will_attend === 'yes').length;
  const rsvpsNoCount = isPerSubeventMode
    ? Array.from(perGuest.values()).filter(v => !v.hasYes && !v.hasMaybe && v.hasNo).length
    : activeRSVPs.filter(r => r.will_attend === 'no').length;
  const rsvpsMaybeCount = isPerSubeventMode
    ? Array.from(perGuest.values()).filter(v => !v.hasYes && v.hasMaybe).length
    : activeRSVPs.filter(r => r.will_attend === 'maybe').length;

  const totalRSVPs = isPerSubeventMode ? perGuest.size : activeRSVPs.length;

  // Attendance estimate: sum max guests_count per guest for yes; then for maybe (only if no yes)
  const confirmedAttendees = isPerSubeventMode
    ? Array.from(perGuest.values()).reduce((sum, v) => sum + (v.hasYes ? (v.maxYesCount || 1) : 0), 0)
    : activeRSVPs
        .filter(r => r.will_attend === 'yes')
        .reduce((sum, r) => sum + (r.guests_count || 1), 0);

  const maybeAttendees = isPerSubeventMode
    ? Array.from(perGuest.values()).reduce((sum, v) => sum + (!v.hasYes && v.hasMaybe ? (v.maxMaybeCount || 1) : 0), 0)
    : activeRSVPs
        .filter(r => r.will_attend === 'maybe')
        .reduce((sum, r) => sum + (r.guests_count || 1), 0);

  const totalExpectedAttendees = confirmedAttendees + maybeAttendees;

  // Guest list coverage + breakdown (core/invited vs direct/other)
  const coreGuestsWithRSVP = isPerSubeventMode
    ? Array.from(perGuest.values()).filter(v => v.isCore).length
    : activeRSVPs.filter(r => r.is_core_guest || r.guest_id).length;
  const otherGuestsRSVP = isPerSubeventMode
    ? Array.from(perGuest.values()).filter(v => !v.isCore).length
    : activeRSVPs.filter(r => !r.is_core_guest && !r.guest_id).length;

  const coreGuestsConfirmed = isPerSubeventMode
    ? Array.from(perGuest.values()).filter(v => v.isCore && v.hasYes).length
    : activeRSVPs.filter(r => (r.is_core_guest || r.guest_id) && r.will_attend === 'yes').length;

  // Response rate
  const responseRate = totalGuests > 0 ? Math.round((coreGuestsWithRSVP / totalGuests) * 100) : 0;
  const inviteStatusLabel =
    invitePublishStatus === 'Published'
      ? 'Live'
      : invitePublishStatus === 'Draft'
        ? 'Configured - Waiting to Publish'
        : 'Not Configured'
  const inviteVisibilityLabel = event.is_public ? 'Public' : 'Private'
  
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
      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-eco-green">{event.title}</h1>
              <p className="text-lg text-gray-700">
                <span className="capitalize">{event.event_type}</span> • {event.city || 'No location'}
              </p>
            </div>
          </div>
        </div>

        {/* Overview at a glance */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-eco-green">Invitation Page Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-gray-800">{inviteStatusLabel}</p>
              <p className="text-xs text-gray-500 mt-1">Visibility: {inviteVisibilityLabel}</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-eco-green-light">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-eco-green">Guest Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-gray-800">{totalGuests} invited</p>
              <p className="text-xs text-gray-500 mt-1">{coreGuestsWithRSVP} responded ({responseRate}%)</p>
            </CardContent>
          </Card>

          {event.has_rsvp && (
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-eco-green">RSVP Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-gray-800">
                  Yes {rsvpsYesCount} • No {rsvpsNoCount} • Maybe {rsvpsMaybeCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">{totalRSVPs} total responses</p>
              </CardContent>
            </Card>
          )}

          {event.has_registry && (
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-eco-green">Registry Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-gray-800">Enabled</p>
                <p className="text-xs text-gray-500 mt-1">
                  {paidOrders.length} gifts • ₹{(totalAmount / 100).toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
          )}

        </div>

        <Card className="bg-white border-2 border-eco-green-light mb-8">
          <CardHeader>
            <CardTitle className="text-eco-green">Important Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'invite' as LinkKey, label: 'Invite Page', url: getInviteUrl(), show: true },
              { key: 'rsvp' as LinkKey, label: 'RSVP Page', url: getRSVPUrl(), show: event.has_rsvp },
              { key: 'registry' as LinkKey, label: 'Registry Page', url: getRegistryUrl(), show: event.has_registry },
            ]
              .filter((item) => item.show)
              .map((item) => {
                const effectiveUrl = getEffectiveUrl(item.key, item.url)
                return (
                <div key={item.key} className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={effectiveUrl}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                    />
                    <div className="relative">
                      <Button
                        onClick={() => setOpenActionsKey((prev) => (prev === item.key ? null : item.key))}
                        variant="outline"
                        aria-haspopup="menu"
                        aria-expanded={openActionsKey === item.key}
                        className="border-eco-green text-eco-green hover:bg-eco-green-light inline-flex items-center gap-2"
                      >
                        Actions
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${openActionsKey === item.key ? 'rotate-180' : ''}`}
                        />
                      </Button>
                      {openActionsKey === item.key && (
                        <div className="absolute right-0 mt-2 w-44 rounded-md border border-gray-200 bg-white shadow-lg z-20">
                          <button
                            type="button"
                            onClick={() => {
                              handleCopyLink(item.key, effectiveUrl)
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {copiedLinkKey === item.key ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleShareLink(item.label, effectiveUrl)
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenQrKey((prev) => (prev === item.key ? null : item.key))
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {openQrKey === item.key ? 'Hide QR' : 'Show QR'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDownloadPickerKey(item.key)
                              setDownloadFormat('professional')
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Download QR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {downloadPickerKey === item.key && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-sm font-semibold text-eco-green">Download QR</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Choose the export format before downloading.
                      </p>

                      <div className="mt-3 space-y-2">
                        <label className="flex items-start gap-2 rounded-md border border-gray-200 p-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`download-format-${item.key}`}
                            checked={downloadFormat === 'professional'}
                            onChange={() => setDownloadFormat('professional')}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">
                            Professional SVG (styled card, centered layout)
                          </span>
                        </label>
                        <label className="flex items-start gap-2 rounded-md border border-gray-200 p-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`download-format-${item.key}`}
                            checked={downloadFormat === 'raw'}
                            onChange={() => setDownloadFormat('raw')}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">Raw SVG (QR only)</span>
                        </label>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDownloadPickerKey(null)}
                          className="h-8 px-3 text-xs border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDownloadWithFormat(item.key)}
                          className="h-8 px-3 text-xs bg-eco-green hover:bg-green-600 text-white"
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  <div
                    id={`tracked-qr-${item.key}`}
                    className={
                      openQrKey === item.key
                        ? 'mt-1 w-full rounded-xl border border-eco-green-light bg-gradient-to-b from-white to-eco-green-light/20 p-4 shadow-sm flex flex-col items-center'
                        : 'hidden'
                    }
                  >
                    <div className="text-center mb-3">
                      <p className="text-sm font-semibold text-eco-green">{item.label} QR</p>
                      <p className="text-xs text-gray-600">Guests can scan this to open the page instantly.</p>
                    </div>

                    <div className="mx-auto inline-block rounded-lg bg-white p-3 border border-gray-200 shadow-sm">
                      <div className="relative inline-block">
                        <QRCode value={effectiveUrl} size={148} level="H" />
                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D7E6D2] bg-white px-2 py-0.5">
                          <span className="text-[9px] leading-none font-semibold text-eco-green">Ekfern</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-center">
                      <Button
                        type="button"
                        onClick={() => setOpenQrKey(null)}
                        variant="outline"
                        className="h-8 px-3 text-xs border-eco-green text-eco-green hover:bg-eco-green-light"
                      >
                        Hide QR
                      </Button>
                    </div>
                  </div>
                </div>
              )})}
            {!event.has_rsvp && !event.has_registry && (
              <div className="text-sm text-gray-600">
                RSVP and Registry links will appear here when those features are enabled.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Click details (attribution & funnel) – only show destinations enabled for this event */}
        {analyticsSummary && (
          <Card className="bg-white border-2 border-eco-green-light mb-8">
            <CardHeader>
              <CardTitle className="text-eco-green">Click details</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                QR and link traffic by destination and channel. In the future this will move to a dedicated analytics or reports page.
              </p>
            </CardHeader>
            <CardContent>
              {analyticsSummary.insights_locked ? (
                <div className="rounded-lg border border-dashed border-eco-green-light p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-eco-green">Attribution insights locked</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Link and QR traffic is being collected. Enable insights to view click and funnel stats here.
                  </p>
                  <Button
                    type="button"
                    onClick={handleEnableInsights}
                    disabled={enablingInsights}
                    className="mt-3 bg-eco-green hover:bg-green-600 text-white h-8 px-3 text-xs"
                  >
                    {enablingInsights ? 'Enabling...' : (analyticsSummary.insights_cta_label || 'Enable tracking insights')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Attribution clicks</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{analyticsSummary.attribution_clicks_total ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-1">Tracked QR/link redirects</p>
                    </div>
                    <div className="rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Clicks by destination</p>
                      <p className="text-sm text-gray-700 mt-2">
                        {[
                          `Invite: ${analyticsSummary.target_type_clicks?.invite ?? 0}`,
                          event.has_rsvp && `RSVP: ${analyticsSummary.target_type_clicks?.rsvp ?? 0}`,
                          event.has_registry && `Registry: ${analyticsSummary.target_type_clicks?.registry ?? 0}`,
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Clicks by channel</p>
                      <p className="text-sm text-gray-700 mt-2">
                        QR: {analyticsSummary.source_channel_breakdown?.qr ?? 0} • Link: {analyticsSummary.source_channel_breakdown?.link ?? 0}
                      </p>
                    </div>
                  </div>
                  {analyticsSummary.funnel && (
                    <div className="mt-3 rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Destination funnels</p>
                      <div className="text-sm text-gray-700 mt-2 space-y-1">
                        <p>
                          Invite: {analyticsSummary.funnel.invite?.clicks ?? 0} clicks → {analyticsSummary.funnel.invite?.views ?? 0} views → {analyticsSummary.funnel.invite?.rsvp_submissions ?? 0} RSVPs
                        </p>
                        {event.has_rsvp && (
                          <p>
                            RSVP: {analyticsSummary.funnel.rsvp?.clicks ?? 0} clicks → {analyticsSummary.funnel.rsvp?.views ?? 0} views → {analyticsSummary.funnel.rsvp?.rsvp_submissions ?? 0} RSVPs
                          </p>
                        )}
                        {event.has_registry && (
                          <p>
                            Registry: {analyticsSummary.funnel.registry?.clicks ?? 0} clicks → {analyticsSummary.funnel.registry?.paid_orders ?? 0} paid orders
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Section */}
        <div className={
          (totalGuests > 0 || totalRSVPs > 0) || (event?.has_registry && !event?.is_expired)
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
                          <p className="text-2xl font-bold text-green-700">{rsvpsYesCount}</p>
                        </div>
                        <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
                          <p className="text-red-700 text-xs font-semibold mb-1 uppercase">No</p>
                          <p className="text-2xl font-bold text-red-700">{rsvpsNoCount}</p>
                        </div>
                        <div className="flex-1 bg-yellow-50 rounded-lg p-3 text-center">
                          <p className="text-yellow-700 text-xs font-semibold mb-1 uppercase">Maybe</p>
                          <p className="text-2xl font-bold text-yellow-700">{rsvpsMaybeCount}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Recent Gifts Section */}
        {event?.has_registry && (
          <div className="mb-8">
            <Card className="bg-white border-2 border-eco-green-light">
              <CardContent className="pt-6">
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-eco-green">Recent Gifts</h3>
                      <span className="rounded-full bg-eco-green-light px-3 py-1 text-xs font-medium text-eco-green">
                        {orders.length}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4">
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
                  </div>
                </details>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings & Configuration Section */}
        <div className="mb-8">
          <Card className="bg-white border-2 border-eco-green-light">
            <CardContent className="pt-6">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-eco-green">Settings & Configuration</h2>
                    <span className="text-xs rounded-full bg-eco-green-light px-3 py-1 font-medium text-eco-green">
                      Expand
                    </span>
                  </div>
                </summary>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
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

    </div>
  )
}

