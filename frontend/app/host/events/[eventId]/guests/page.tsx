'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api, { getGuestsAnalytics, getEventAnalyticsSummary, getAnalyticsBatchStatus, type GuestAnalytics, type EventAnalyticsSummary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getCountryCode, formatPhoneWithCountryCode } from '@/lib/countryCodesFull'
import CountryCodeSelector from '@/components/CountryCodeSelector'
import { generateWhatsAppLink, generateGuestMessage, openWhatsApp, replaceTemplateVariables } from '@/lib/whatsapp'
import { logError } from '@/lib/error-handler'
import { WhatsAppTemplate, incrementWhatsAppTemplateUsage } from '@/lib/api'
import dynamic from 'next/dynamic'

const TemplateSelector = dynamic(
  () => import('@/components/communications/TemplateSelector'),
  {
    ssr: false
  }
)

const guestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone number is required (minimum 10 digits)'),
  country_code: z.string().optional(),
  country_iso: z.string().optional(),  // ISO country code for analytics
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relationship: z.string().optional(),
  notes: z.string().optional(),
  custom_fields: z.record(z.string()).optional(),
})

type GuestForm = z.infer<typeof guestSchema>

interface Guest {
  id: number
  name: string
  phone: string
  country_code: string | null
  country_iso?: string | null
  local_number: string | null
  email: string
  relationship: string
  notes: string
  rsvp_status: string | null
  rsvp_will_attend: string | null
  rsvp_guests_count: number | null
  invitation_sent: boolean
  invitation_sent_at: string | null
  is_removed?: boolean
  created_at?: string
  guest_token?: string | null
  custom_fields?: Record<string, string>
  sub_event_invites?: number[] // Sub-event IDs this guest is invited to
  // Analytics fields
  invite_views_count?: number
  rsvp_views_count?: number
  last_invite_view?: string | null
  last_rsvp_view?: string | null
  has_viewed_invite?: boolean
  has_viewed_rsvp?: boolean
}

interface OtherGuest {
  id: number
  name: string
  phone: string
  country_code: string | null
  local_number: string | null
  email: string
  will_attend: 'yes' | 'no' | 'maybe'
  guests_count: number
  notes: string
  source_channel: string
  created_at: string
  updated_at: string
  is_removed?: boolean
}

interface Event {
  id: number
  slug: string
  title: string
  date: string | null
  country: string
  country_code: string
  city?: string
  whatsapp_message_template?: string
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  rsvp_mode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  host_name?: string
  custom_fields_metadata?: Record<string, any>
  has_rsvp?: boolean
  has_registry?: boolean
}

type CustomFieldMeta = {
  id: string
  key: string
  display_label: string
  active: boolean
  originalKey?: string
}

interface SubEvent {
  id: number
  title: string
  start_at: string
  end_at: string | null
  location: string
  description: string | null
  image_url: string | null
  rsvp_enabled: boolean
  is_public_visible: boolean
}

export default function GuestsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [guests, setGuests] = useState<Guest[]>([])
  const [otherGuests, setOtherGuests] = useState<OtherGuest[]>([])
  const [removedGuestsList, setRemovedGuestsList] = useState<Guest[]>([])
  const [removedGuests, setRemovedGuests] = useState<OtherGuest[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importErrors, setImportErrors] = useState<string[] | null>(null)
  const [importSummary, setImportSummary] = useState<{created: number, errors: number} | null>(null)
  const [sharingWhatsApp, setSharingWhatsApp] = useState<number | null>(null)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [rsvpFilter, setRsvpFilter] = useState<'all' | 'unconfirmed' | 'confirmed' | 'no'>('all')
  const [rsvpFilterMode, setRsvpFilterMode] = useState<'include' | 'exclude'>('include')
  type CategorySource = 'relationship' | `cf:${string}`
  const [categorySource, setCategorySource] = useState<CategorySource>('relationship')
  const [categoryValue, setCategoryValue] = useState<string>('all')
  const [categoryFilterMode, setCategoryFilterMode] = useState<'include' | 'exclude'>('include')
  const [inviteSentFilter, setInviteSentFilter] = useState<'all' | 'sent' | 'not_sent'>('all')
  const [inviteSentFilterMode, setInviteSentFilterMode] = useState<'include' | 'exclude'>('include')
  const [selectedSubEventFilterIds, setSelectedSubEventFilterIds] = useState<Set<number>>(new Set())
  const [subEventFilterMode, setSubEventFilterMode] = useState<'include' | 'exclude'>('include')
  const [showSubEventFilterMenu, setShowSubEventFilterMenu] = useState(false)
  const subEventFilterRef = useRef<HTMLDivElement>(null)

  // Column visibility (host configurable, middle-only)
  type MiddleColumnKey =
    | 'email'
    | 'relationship'
    | 'guests_count'
    | 'notes'
    | 'sub_events_attending'
    | `cf:${string}`

  const MAX_MIDDLE_COLUMNS = 5
  const columnsStorageKey = `guestTableColumns:${eventId}`
  const [visibleMiddleColumns, setVisibleMiddleColumns] = useState<MiddleColumnKey[]>([
    'email', // default ON (per request)
    'relationship',
    'guests_count',
    'notes',
  ])
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const columnsMenuRef = useRef<HTMLDivElement>(null)
  const [sortKey, setSortKey] = useState<
    | 'name'
    | 'email'
    | 'category'
    | 'rsvp_status'
    | 'guests_count'
    | 'invite_sent'
    | 'sub_events_assigned'
    | 'sub_events_attending'
    | 'notes'
  >('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showImportExportMenu, setShowImportExportMenu] = useState(false)
  const [showImportInstructions, setShowImportInstructions] = useState(false)
  const [subEvents, setSubEvents] = useState<SubEvent[]>([])
  const [showSubEventAssignment, setShowSubEventAssignment] = useState<number | null>(null)
  const [guestSubEventAssignments, setGuestSubEventAssignments] = useState<Record<number, number[]>>({})
  const [guestRSVPs, setGuestRSVPs] = useState<Record<number, any[]>>({})
  const [copiedGuestId, setCopiedGuestId] = useState<number | null>(null)
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<number>>(new Set())
  const [showBulkSubEventAssignment, setShowBulkSubEventAssignment] = useState(false)
  const [bulkSelectedSubEventIds, setBulkSelectedSubEventIds] = useState<Set<number>>(new Set())
  const [showCustomFieldsManager, setShowCustomFieldsManager] = useState(false)
  const [customFieldsDraft, setCustomFieldsDraft] = useState<CustomFieldMeta[]>([])
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [showAnalyticsSummary, setShowAnalyticsSummary] = useState(true)
  const [nameSearch, setNameSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasInitializedFiltersRef = useRef(false)

  const makeDraftId = () => {
    try {
      return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`
    } catch {
      return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
  })

  useEffect(() => {
    const loadData = async () => {
      await fetchEvent()
      await fetchGuests()
      // Fetch analytics after guests are loaded so we can merge the data
      await fetchAnalytics()
    }
    loadData()
  }, [eventId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const applyViewportState = (mobile: boolean) => {
      setIsMobileViewport(mobile)
      setShowAnalyticsSummary(!mobile)
    }

    applyViewportState(mediaQuery.matches)

    const onMediaChange = (event: MediaQueryListEvent) => {
      applyViewportState(event.matches)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onMediaChange)
      return () => mediaQuery.removeEventListener('change', onMediaChange)
    }

    mediaQuery.addListener(onMediaChange)
    return () => mediaQuery.removeListener(onMediaChange)
  }, [])

  // Poll analytics directly to detect changes (more reliable than batch status)
  // Uses guest IDs to compare view counts and detect when batch processing adds new views
  useEffect(() => {
    if (!eventId) return

    const pollAnalytics = async () => {
      try {
        // Poll analytics endpoint directly - it already filters by event and returns guest IDs
        const analyticsResponse = await getGuestsAnalytics(parseInt(eventId))
        
        // Compare with current analytics data (from ref) to detect changes
        const currentAnalyticsData = analyticsDataRef.current
        let hasChanges = false
        
        // Check each guest for changes
        analyticsResponse.guests.forEach((guest: GuestAnalytics) => {
          const prevGuest = currentAnalyticsData[guest.id]
          
          // Check if view counts or timestamps changed
          if (!prevGuest || 
              prevGuest.invite_views_count !== guest.invite_views_count ||
              prevGuest.rsvp_views_count !== guest.rsvp_views_count ||
              prevGuest.last_invite_view !== guest.last_invite_view ||
              prevGuest.last_rsvp_view !== guest.last_rsvp_view ||
              prevGuest.has_viewed_invite !== guest.has_viewed_invite ||
              prevGuest.has_viewed_rsvp !== guest.has_viewed_rsvp) {
            hasChanges = true
          }
        })
        
        // Also check if any guests were removed (had analytics before but not now)
        Object.keys(currentAnalyticsData).forEach(guestId => {
          if (!analyticsResponse.guests.find(g => g.id === parseInt(guestId))) {
            hasChanges = true
          }
        })
        
        // If changes detected, refresh analytics (which will update state and merge into guests)
        if (hasChanges) {
          console.log('[Analytics] Detected changes in analytics data, refreshing UI...', {
            guests_checked: analyticsResponse.guests.length,
            event_id: eventId
          })
          await fetchAnalytics(true) // Silent refresh - don't show loading indicator
        }
      } catch (error) {
        // Silently fail - polling errors shouldn't break the UI
        console.debug('Failed to poll analytics:', error)
      }
    }

    // Poll every 10 seconds to detect new views after batch processing
    const interval = setInterval(pollAnalytics, 10000)
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  useEffect(() => {
    if (event?.event_structure === 'ENVELOPE') {
      fetchSubEvents()
    }
  }, [event?.event_structure])

  useEffect(() => {
    if (event?.event_structure === 'ENVELOPE') {
      fetchSubEvents()
      // Re-initialize assignments when event loads if guests are already loaded
      if (guests.length > 0) {
        const assignments: Record<number, number[]> = {}
        guests.forEach((guest: Guest) => {
          if (guest.sub_event_invites && Array.isArray(guest.sub_event_invites)) {
            assignments[guest.id] = guest.sub_event_invites
          } else {
            assignments[guest.id] = []
          }
        })
        setGuestSubEventAssignments(prev => ({ ...prev, ...assignments }))
      }
    }
  }, [event?.event_structure, guests])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowImportExportMenu(false)
      }
      if (subEventFilterRef.current && !subEventFilterRef.current.contains(event.target as Node)) {
        setShowSubEventFilterMenu(false)
      }
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(event.target as Node)) {
        setShowColumnsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initialize filter/sort state from URL query params (one-time)
  useEffect(() => {
    if (hasInitializedFiltersRef.current) return
    const rsvp = searchParams.get('rsvp')
    const rsvpMode = searchParams.get('rsvpMode')
    const catSrc = searchParams.get('catSrc')
    const catVal = searchParams.get('catVal')
    const catMode = searchParams.get('catMode')
    const cat = searchParams.get('cat') // backward compat: relationship value
    const sent = searchParams.get('sent')
    const sentMode = searchParams.get('sentMode')
    const sub = searchParams.get('sub')
    const subMode = searchParams.get('subMode')
    const sort = searchParams.get('sort')
    const dir = searchParams.get('dir')

    if (rsvp === 'unconfirmed' || rsvp === 'confirmed' || rsvp === 'no') {
      setRsvpFilter(rsvp)
      if (rsvpMode === 'exclude') setRsvpFilterMode('exclude')
    }
    if (catSrc && (catSrc === 'relationship' || catSrc.startsWith('cf:'))) {
      setCategorySource(catSrc as CategorySource)
      setCategoryValue(catVal || 'all')
      if (catMode === 'exclude') setCategoryFilterMode('exclude')
    } else if (cat) {
      // Backward compat: old `cat` meant relationship filter value
      setCategorySource('relationship')
      setCategoryValue(cat)
    }
    if (sent === 'sent' || sent === 'not_sent' || sent === 'all') {
      setInviteSentFilter(sent)
      if (sentMode === 'exclude') setInviteSentFilterMode('exclude')
    }
    if (sub) {
      const ids = sub
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => Number.isFinite(n))
      setSelectedSubEventFilterIds(new Set(ids))
      if (subMode === 'exclude') setSubEventFilterMode('exclude')
    }
    if (
      sort === 'name' ||
      sort === 'email' ||
      sort === 'category' ||
      sort === 'rsvp_status' ||
      sort === 'guests_count' ||
      sort === 'invite_sent' ||
      sort === 'sub_events_assigned' ||
      sort === 'sub_events_attending' ||
      sort === 'notes'
    ) {
      setSortKey(sort)
    }
    if (dir === 'asc' || dir === 'desc') setSortDir(dir)

    hasInitializedFiltersRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Initialize visible columns from localStorage (one-time per event)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(columnsStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .filter((c: any) => typeof c === 'string')
          .slice(0, MAX_MIDDLE_COLUMNS) as MiddleColumnKey[]
        if (cleaned.length > 0) setVisibleMiddleColumns(cleaned)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // Persist visible columns to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(columnsStorageKey, JSON.stringify(visibleMiddleColumns.slice(0, MAX_MIDDLE_COLUMNS)))
    } catch {
      // ignore
    }
  }, [columnsStorageKey, visibleMiddleColumns])

  // Persist filter/sort state to URL query params
  useEffect(() => {
    if (!hasInitializedFiltersRef.current) return
    const params = new URLSearchParams(searchParams.toString())
    const basePath = `/host/events/${eventId}/guests`

    const isDefault =
      rsvpFilter === 'all' &&
      categorySource === 'relationship' &&
      categoryValue === 'all' &&
      inviteSentFilter === 'all' &&
      selectedSubEventFilterIds.size === 0 &&
      sortKey === 'name' &&
      sortDir === 'asc' &&
      rsvpFilterMode === 'include' &&
      categoryFilterMode === 'include' &&
      inviteSentFilterMode === 'include' &&
      subEventFilterMode === 'include'

    if (isDefault) {
      params.delete('cat')
      params.delete('catSrc')
      params.delete('catVal')
      params.delete('sent')
      params.delete('sub')
      params.delete('sort')
      params.delete('dir')
      params.delete('rsvp')
      params.delete('rsvpMode')
      params.delete('catMode')
      params.delete('sentMode')
      params.delete('subMode')
    } else {
      // Remove legacy param always
      params.delete('cat')

      // RSVP filter
      if (rsvpFilter === 'all') {
        params.delete('rsvp')
        params.delete('rsvpMode')
      } else {
        params.set('rsvp', rsvpFilter)
        if (rsvpFilterMode === 'include') params.delete('rsvpMode')
        else params.set('rsvpMode', rsvpFilterMode)
      }

      if (categorySource === 'relationship' && categoryValue === 'all') {
        params.delete('catSrc')
        params.delete('catVal')
        params.delete('catMode')
      } else {
        params.set('catSrc', categorySource)
        if (categoryValue === 'all') {
          params.delete('catVal')
          params.delete('catMode')
        } else {
          params.set('catVal', categoryValue)
          if (categoryFilterMode === 'include') params.delete('catMode')
          else params.set('catMode', categoryFilterMode)
        }
      }

      if (inviteSentFilter === 'all') {
        params.delete('sent')
        params.delete('sentMode')
      } else {
        params.set('sent', inviteSentFilter)
        if (inviteSentFilterMode === 'include') params.delete('sentMode')
        else params.set('sentMode', inviteSentFilterMode)
      }

      if (selectedSubEventFilterIds.size === 0) {
        params.delete('sub')
        params.delete('subMode')
      } else {
        params.set('sub', Array.from(selectedSubEventFilterIds).sort((a, b) => a - b).join(','))
        if (subEventFilterMode === 'include') params.delete('subMode')
        else params.set('subMode', subEventFilterMode)
      }

      if (sortKey === 'name') params.delete('sort')
      else params.set('sort', sortKey)

      if (sortDir === 'asc') params.delete('dir')
      else params.set('dir', sortDir)
    }

    const qs = params.toString()
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rsvpFilter,
    rsvpFilterMode,
    categorySource,
    categoryValue,
    categoryFilterMode,
    inviteSentFilter,
    inviteSentFilterMode,
    // Convert Set to sorted array string for stable comparison
    Array.from(selectedSubEventFilterIds).sort((a, b) => a - b).join(','),
    subEventFilterMode,
    sortKey,
    sortDir,
    eventId,
  ])

  const getAssignedSubEventIds = (guest: Guest): number[] => {
    const ids = guestSubEventAssignments[guest.id] ?? guest.sub_event_invites ?? []
    return Array.isArray(ids) ? ids : []
  }

  const getRsvpSortValue = (guest: Guest): number => {
    const status = (guest.rsvp_status || guest.rsvp_will_attend || '').toLowerCase()
    // Pending first, then yes, maybe, no (most useful grouping)
    if (!status) return 0
    if (status === 'yes') return 1
    if (status === 'maybe') return 2
    if (status === 'no') return 3
    return 4
  }

  const getSubEventsAttendingSortValue = (guest: Guest): number => {
    const rsvps = guestRSVPs[guest.id] || []
    const attending = rsvps.filter((r: any) => r.will_attend === 'yes' && r.sub_event_title)
    return attending.length
  }

  const visibleGuests = useMemo(() => {
    let list = guests.filter(g => !g.is_removed)

    // Name search
    const searchTrim = nameSearch.trim()
    if (searchTrim) {
      const q = searchTrim.toLowerCase()
      list = list.filter(g => (g.name || '').toLowerCase().includes(q))
    }

    // RSVP status filter
    if (rsvpFilter !== 'all') {
      const matchesRsvp = (g: Guest) => {
        if (rsvpFilter === 'unconfirmed') {
          return !g.rsvp_status && !g.rsvp_will_attend
        } else if (rsvpFilter === 'confirmed') {
          return g.rsvp_status === 'yes' || g.rsvp_will_attend === 'yes'
        } else if (rsvpFilter === 'no') {
          return g.rsvp_status === 'no' || g.rsvp_will_attend === 'no'
        }
        return false
      }
      
      if (rsvpFilterMode === 'include') {
        list = list.filter(matchesRsvp)
      } else {
        list = list.filter(g => !matchesRsvp(g))
      }
    }

    // Category filter (relationship OR selected custom field)
    if (categoryValue !== 'all') {
      const matchesCategory = (g: Guest) => {
        if (categorySource === 'relationship') {
          return (g.relationship || '').trim() === categoryValue
        } else {
          const key = categorySource.slice(3)
          return (g.custom_fields?.[key] || '').trim() === categoryValue
        }
      }
      
      if (categoryFilterMode === 'include') {
        list = list.filter(matchesCategory)
      } else {
        list = list.filter(g => !matchesCategory(g))
      }
    }

    // Invite sent filter
    if (inviteSentFilter !== 'all') {
      const matchesInviteSent = (g: Guest) => {
        if (inviteSentFilter === 'sent') {
          return !!g.invitation_sent
        } else if (inviteSentFilter === 'not_sent') {
          return !g.invitation_sent
        }
        return false
      }
      
      if (inviteSentFilterMode === 'include') {
        list = list.filter(matchesInviteSent)
      } else {
        list = list.filter(g => !matchesInviteSent(g))
      }
    }

    // Sub-event assignment filter (any match)
    if (selectedSubEventFilterIds.size > 0) {
      const matchesSubEvent = (g: Guest) => {
        const assigned = getAssignedSubEventIds(g)
        return assigned.some(id => selectedSubEventFilterIds.has(id))
      }
      
      if (subEventFilterMode === 'include') {
        list = list.filter(matchesSubEvent)
      } else {
        list = list.filter(g => !matchesSubEvent(g))
      }
    }

    // Sorting
    const dir = sortDir === 'asc' ? 1 : -1
    const byStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) * dir

    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'name') return byStr(a.name || '', b.name || '')
      if (sortKey === 'email') return byStr(a.email || '', b.email || '') || byStr(a.name || '', b.name || '')
      if (sortKey === 'category') return byStr((a.relationship || '').trim(), (b.relationship || '').trim())
      if (sortKey === 'rsvp_status') return (getRsvpSortValue(a) - getRsvpSortValue(b)) * dir || byStr(a.name || '', b.name || '')
      if (sortKey === 'guests_count') {
        const av = a.rsvp_guests_count ?? -1
        const bv = b.rsvp_guests_count ?? -1
        return (av - bv) * dir || byStr(a.name || '', b.name || '')
      }
      if (sortKey === 'invite_sent') {
        const av = a.invitation_sent ? 1 : 0
        const bv = b.invitation_sent ? 1 : 0
        return (av - bv) * dir || byStr(a.name || '', b.name || '')
      }
      if (sortKey === 'sub_events_assigned') {
        const av = getAssignedSubEventIds(a).length
        const bv = getAssignedSubEventIds(b).length
        return (av - bv) * dir || byStr(a.name || '', b.name || '')
      }
      if (sortKey === 'sub_events_attending') {
        const av = getSubEventsAttendingSortValue(a)
        const bv = getSubEventsAttendingSortValue(b)
        return (av - bv) * dir || byStr(a.name || '', b.name || '')
      }
      if (sortKey === 'notes') return byStr(a.notes || '', b.notes || '') || byStr(a.name || '', b.name || '')
      return byStr(a.name || '', b.name || '')
    })

    return sorted
  }, [
    guests,
    nameSearch,
    rsvpFilter,
    rsvpFilterMode,
    categorySource,
    categoryValue,
    categoryFilterMode,
    inviteSentFilter,
    inviteSentFilterMode,
    selectedSubEventFilterIds,
    subEventFilterMode,
    sortKey,
    sortDir,
    guestSubEventAssignments,
  ])

  const toggleSort = (nextKey: typeof sortKey) => {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(nextKey)
      setSortDir('asc')
    }
  }

  const sortArrow = (key: typeof sortKey) => {
    if (sortKey !== key) return null
    return <span className="ml-1 text-xs text-gray-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const toggleMiddleColumn = (key: MiddleColumnKey) => {
    setVisibleMiddleColumns(prev => {
      const has = prev.includes(key)
      if (has) return prev.filter(k => k !== key)
      if (prev.length >= MAX_MIDDLE_COLUMNS) {
        showToast(`You can show up to ${MAX_MIDDLE_COLUMNS} middle columns`, 'error')
        return prev
      }
      return [...prev, key]
    })
  }

  const resetMiddleColumns = () => {
    setVisibleMiddleColumns(['email', 'relationship', 'guests_count', 'notes'])
  }

  const getDisplayPhone = (guest: Guest): string => {
    const local = (guest.local_number || '').toString().trim()
    if (local) {
      const cc = (guest.country_code || '').toString().trim()
      return `${cc} ${local}`.trim()
    }
    const phone = (guest.phone || '').toString().trim()
    return phone || '-'
  }

  const getMiddleColumnLabel = (col: MiddleColumnKey): string => {
    if (col === 'email') return 'Email'
    if (col === 'relationship') return 'Relationship'
    if (col === 'guests_count') return 'Guests Count'
    if (col === 'notes') return 'Notes'
    if (col === 'sub_events_attending') return 'Sub-Events Attending'
    if (col.startsWith('cf:')) {
      const key = col.slice(3)
      return getActiveCustomFields().find(f => f.key === key)?.display_label || key
    }
    return col
  }

  const middleColumnOptions = (): Array<{ key: MiddleColumnKey; label: string }> => {
    const opts: Array<{ key: MiddleColumnKey; label: string }> = [
      { key: 'email', label: 'Email' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'guests_count', label: 'Guests Count' },
      { key: 'notes', label: 'Notes' },
    ]

    if (event?.event_structure === 'ENVELOPE' && event?.rsvp_mode === 'PER_SUBEVENT') {
      opts.push({ key: 'sub_events_attending', label: 'Sub-Events Attending' })
    }

    getActiveCustomFields().forEach(f => {
      opts.push({ key: `cf:${f.key}`, label: f.display_label })
    })

    return opts
  }

  const middleColumnsToRender = useMemo(() => {
    const allowed = new Set(middleColumnOptions().map(o => o.key))
    return visibleMiddleColumns.filter(c => allowed.has(c)).slice(0, MAX_MIDDLE_COLUMNS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMiddleColumns, event?.event_structure, event?.rsvp_mode, event?.custom_fields_metadata])

  const tableColSpan =
    1 + // selection checkbox
    2 + // name + phone
    1 + // analytics column
    middleColumnsToRender.length +
    2 + // rsvp status + invitation sent
    (event?.event_structure === 'ENVELOPE' ? 1 : 0) + // sub-events assigned
    1 // actions

  
  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
      // Initialize custom fields draft from event metadata (if present)
      const meta = response.data?.custom_fields_metadata || {}
      const rows: CustomFieldMeta[] = Object.entries(meta).map(([key, value]: any) => {
        if (typeof value === 'string') {
          return { id: key, key, originalKey: key, display_label: value, active: true }
        }
        return {
          id: key,
          key,
          originalKey: key,
          display_label: value?.display_label || key,
          active: value?.active !== false,
        }
      })
      setCustomFieldsDraft(rows.sort((a, b) => a.display_label.localeCompare(b.display_label)))
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
        logError('Failed to fetch event:', error)
      }
    }
  }

  function getActiveCustomFields() {
    const meta = event?.custom_fields_metadata || {}
    const fields: { key: string; display_label: string }[] = []
    Object.entries(meta).forEach(([key, value]: any) => {
      if (typeof value === 'string') {
        fields.push({ key, display_label: value || key })
      } else if (value?.active !== false) {
        fields.push({ key, display_label: value?.display_label || key })
      }
    })
    return fields.sort((a, b) => a.display_label.localeCompare(b.display_label))
  }

  const categorySourceOptions = useMemo(() => {
    const opts: Array<{ value: CategorySource; label: string }> = [{ value: 'relationship', label: 'Relationship' }]
    getActiveCustomFields().forEach((f) => {
      opts.push({ value: `cf:${f.key}`, label: f.display_label })
    })
    return opts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.custom_fields_metadata])

  const categoryValueOptions = useMemo(() => {
    const values = new Set<string>()
    if (categorySource === 'relationship') {
      guests.forEach((g) => {
        const v = (g.relationship || '').trim()
        if (v) values.add(v)
      })
    } else {
      const key = categorySource.slice(3)
      guests.forEach((g) => {
        const v = (g.custom_fields?.[key] || '').trim()
        if (v) values.add(v)
      })
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [guests, categorySource])

  // If source changes (or data changes), keep the selected value valid
  useEffect(() => {
    if (categoryValue !== 'all' && !categoryValueOptions.includes(categoryValue)) {
      setCategoryValue('all')
    }
  }, [categorySource, categoryValue, categoryValueOptions])

  const normalizeCustomFieldKey = (raw: string) => {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 50)
  }

  const handleSaveCustomFields = async () => {
    try {
      const MAX_FIELDS = 50
      if (customFieldsDraft.length > MAX_FIELDS) {
        showToast(`Too many custom fields (max ${MAX_FIELDS})`, 'error')
        return
      }

      const upsert: any[] = []
      const rename: any[] = []

      customFieldsDraft.forEach((row) => {
        const key = normalizeCustomFieldKey(row.key)
        if (!key) return
        const display_label = (row.display_label || key).slice(0, 80)
        const active = row.active !== false

        if (row.originalKey && row.originalKey !== key) {
          rename.push({ from: row.originalKey, to: key, display_label })
          upsert.push({ key, display_label, active })
        } else {
          upsert.push({ key, display_label, active })
        }
      })

      const resp = await api.patch(`/api/events/${eventId}/custom-fields/`, { upsert, rename })
      setEvent((prev) => (prev ? { ...prev, custom_fields_metadata: resp.data.custom_fields_metadata } : prev))

      // Refresh draft from canonical metadata
      const meta = resp.data.custom_fields_metadata || {}
      const rows: CustomFieldMeta[] = Object.entries(meta).map(([key, value]: any) => {
        if (typeof value === 'string') {
          return { id: key, key, originalKey: key, display_label: value, active: true }
        }
        return {
          id: key,
          key,
          originalKey: key,
          display_label: value?.display_label || key,
          active: value?.active !== false,
        }
      })
      setCustomFieldsDraft(rows.sort((a, b) => a.display_label.localeCompare(b.display_label)))
      showToast('Custom fields updated', 'success')
      setShowCustomFieldsManager(false)
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to update custom fields'
      showToast(msg, 'error')
    }
  }

  const [analyticsData, setAnalyticsData] = useState<Record<number, GuestAnalytics>>({})
  const analyticsDataRef = useRef<Record<number, GuestAnalytics>>({})
  const [analyticsSummary, setAnalyticsSummary] = useState<EventAnalyticsSummary | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingAnalytics(true)
      }
      const [analyticsResponse, summaryResponse] = await Promise.all([
        getGuestsAnalytics(parseInt(eventId)),
        getEventAnalyticsSummary(parseInt(eventId))
      ])
      
      // Create a map of guest ID to analytics data
      const analyticsMap: Record<number, GuestAnalytics> = {}
      analyticsResponse.guests.forEach((guest: GuestAnalytics) => {
        analyticsMap[guest.id] = guest
      })
      setAnalyticsData(analyticsMap)
      analyticsDataRef.current = analyticsMap // Keep ref in sync
      setAnalyticsSummary(summaryResponse)
      
      // Debug: Log analytics data
      if (process.env.NODE_ENV === 'development' && !silent) {
        console.log('[Analytics] Fetched analytics for', Object.keys(analyticsMap).length, 'guests')
        const sampleGuestId = Object.keys(analyticsMap)[0]
        if (sampleGuestId) {
          const sample = analyticsMap[parseInt(sampleGuestId)]
          console.log('[Analytics] Sample data:', {
            id: sample.id,
            name: sample.name,
            invite_views_count: sample.invite_views_count,
            rsvp_views_count: sample.rsvp_views_count,
            has_viewed_invite: sample.has_viewed_invite,
            has_viewed_rsvp: sample.has_viewed_rsvp,
          })
        }
      }
      
      // Merge analytics data into existing guests
      setGuests(prevGuests => {
        if (prevGuests.length === 0) {
          // If no guests loaded yet, analytics will be merged when guests are fetched
          return prevGuests
        }
        return prevGuests.map((guest: Guest) => {
          const analytics = analyticsMap[guest.id]
          if (analytics) {
            return {
              ...guest,
              invite_views_count: analytics.invite_views_count,
              rsvp_views_count: analytics.rsvp_views_count,
              last_invite_view: analytics.last_invite_view,
              last_rsvp_view: analytics.last_rsvp_view,
              has_viewed_invite: analytics.has_viewed_invite,
              has_viewed_rsvp: analytics.has_viewed_rsvp,
            }
          }
          // If no analytics for this guest, ensure defaults are set
          return {
            ...guest,
            invite_views_count: guest.invite_views_count || 0,
            rsvp_views_count: guest.rsvp_views_count || 0,
            has_viewed_invite: guest.has_viewed_invite || false,
            has_viewed_rsvp: guest.has_viewed_rsvp || false,
          }
        })
      })
    } catch (error: any) {
      // Log error for debugging but don't break the UI
      console.error('Failed to fetch analytics:', error)
      if (error.response?.status === 404) {
        console.warn('Analytics endpoints not available - migrations may not be run yet')
      }
    } finally {
      if (!silent) {
        setLoadingAnalytics(false)
      }
    }
  }

  const fetchGuests = async () => {
    try {
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now()
      const response = await api.get(`/api/events/${eventId}/guests/`, {
        params: { _t: timestamp },
      })
      // Handle both old format (array) and new format (object with guests and other_guests)
      let allGuests: Guest[] = []
      if (Array.isArray(response.data)) {
        allGuests = response.data.filter((g: Guest) => !g.is_removed)
        setGuests(allGuests)
        setRemovedGuestsList(response.data.filter((g: Guest) => g.is_removed))
        setOtherGuests([])
        setRemovedGuests([])
      } else {
        allGuests = response.data.guests || []
        setOtherGuests(response.data.other_guests || [])
        setRemovedGuestsList(response.data.removed_guests_list || [])
        setRemovedGuests(response.data.removed_guests || [])
      }
      
      // Initialize sub-event assignments from guest data if available
      // Always initialize from guest data (backend serializer includes sub_event_invites)
      // Don't wait for event to load - use guest data directly
      const assignments: Record<number, number[]> = {}
      allGuests.forEach((guest: Guest) => {
        // sub_event_invites is returned by the backend serializer
        if (guest.sub_event_invites && Array.isArray(guest.sub_event_invites)) {
          assignments[guest.id] = guest.sub_event_invites
        } else {
          // Initialize with empty array if no assignments exist
          assignments[guest.id] = []
        }
      })
      
      setGuestSubEventAssignments(assignments)
      
      // Merge analytics data if it's already been fetched
      if (Object.keys(analyticsData).length > 0) {
        allGuests = allGuests.map((guest: Guest) => {
          const analytics = analyticsData[guest.id]
          if (analytics) {
            return {
              ...guest,
              invite_views_count: analytics.invite_views_count,
              rsvp_views_count: analytics.rsvp_views_count,
              last_invite_view: analytics.last_invite_view,
              last_rsvp_view: analytics.last_rsvp_view,
              has_viewed_invite: analytics.has_viewed_invite,
              has_viewed_rsvp: analytics.has_viewed_rsvp,
            }
          }
          // Ensure defaults even if no analytics
          return {
            ...guest,
            invite_views_count: guest.invite_views_count ?? 0,
            rsvp_views_count: guest.rsvp_views_count ?? 0,
            has_viewed_invite: guest.has_viewed_invite ?? false,
            has_viewed_rsvp: guest.has_viewed_rsvp ?? false,
          }
        })
      }
      
      setGuests(allGuests)
      
      // Fetch RSVPs for all guests (only for PER_SUBEVENT mode)
      // Check event structure after it's loaded
      if (event?.event_structure === 'ENVELOPE' && event?.rsvp_mode === 'PER_SUBEVENT') {
        await fetchAllGuestRSVPs()
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
        showToast('Failed to load guest list', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchSubEvents = async () => {
    if (event?.event_structure !== 'ENVELOPE') return
    try {
      const response = await api.get(`/api/events/envelopes/${eventId}/sub-events/`)
      setSubEvents(response.data.results || response.data || [])
    } catch (error: any) {
      // Event might not be ENVELOPE yet, that's okay
      if (error.response?.status !== 404) {
        logError('Failed to fetch sub-events:', error)
      }
    }
  }

  const fetchGuestSubEventAssignments = async (guestId: number) => {
    try {
      // Use the by_event endpoint to get all guests, then find the specific guest
      // This is the correct endpoint that exists in the backend
      const response = await api.get(`/api/events/envelopes/${eventId}/guests/`)
      const guestsData = Array.isArray(response.data) ? response.data : []
      const guestData = guestsData.find((g: any) => g.guest?.id === guestId)
      
      if (guestData && guestData.sub_event_ids) {
        setGuestSubEventAssignments(prev => ({ ...prev, [guestId]: guestData.sub_event_ids }))
      } else {
        // Guest might not have assignments yet
        setGuestSubEventAssignments(prev => ({ ...prev, [guestId]: [] }))
      }
    } catch (error: any) {
      // Guest might not have assignments yet
      logError('Failed to fetch guest sub-event assignments:', error)
      setGuestSubEventAssignments(prev => ({ ...prev, [guestId]: [] }))
    }
  }

  const fetchGuestRSVPs = async (guestId: number) => {
    try {
      // Fetch all RSVPs for this event and filter by guest_id
      const response = await api.get(`/api/events/${eventId}/rsvps/`)
      const allRsvps = Array.isArray(response.data) 
        ? response.data 
        : (response.data.results || [])
      
      // Filter RSVPs for this guest where will_attend is 'yes'
      const guestRsvps = allRsvps.filter((rsvp: any) => 
        rsvp.guest_id === guestId && rsvp.will_attend === 'yes'
      )
      
      setGuestRSVPs(prev => ({ ...prev, [guestId]: guestRsvps }))
    } catch (error: any) {
      logError('Failed to fetch guest RSVPs:', error)
      setGuestRSVPs(prev => ({ ...prev, [guestId]: [] }))
    }
  }

  const fetchAllGuestRSVPs = async () => {
    if (event?.event_structure !== 'ENVELOPE' || event?.rsvp_mode !== 'PER_SUBEVENT') {
      return
    }
    
    try {
      // Fetch all RSVPs for this event
      const response = await api.get(`/api/events/${eventId}/rsvps/`)
      const allRsvps = Array.isArray(response.data) 
        ? response.data 
        : (response.data.results || [])
      
      // Group RSVPs by guest_id
      const rsvpsByGuest: Record<number, any[]> = {}
      allRsvps.forEach((rsvp: any) => {
        if (rsvp.guest_id && rsvp.will_attend === 'yes') {
          if (!rsvpsByGuest[rsvp.guest_id]) {
            rsvpsByGuest[rsvp.guest_id] = []
          }
          rsvpsByGuest[rsvp.guest_id].push(rsvp)
        }
      })
      
      setGuestRSVPs(rsvpsByGuest)
    } catch (error: any) {
      logError('Failed to fetch all guest RSVPs:', error)
    }
  }

  const handleSaveSubEventAssignments = async (guestId: number) => {
    try {
      const subEventIds = guestSubEventAssignments[guestId] || []
      
      const response = await api.put(`/api/events/guests/${guestId}/invites/`, {
        sub_event_ids: subEventIds
      })
      
      showToast('Sub-event assignments updated', 'success')
      setShowSubEventAssignment(null)
      
      // Refresh guests to get updated guest_token and assignments
      await fetchGuests()
    } catch (error: any) {
      showToast('Failed to update sub-event assignments', 'error')
      logError('Failed to update guest invites:', error)
    }
  }

  const handleToggleGuestSelection = (guestId: number) => {
    setSelectedGuestIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(guestId)) {
        newSet.delete(guestId)
      } else {
        newSet.add(guestId)
      }
      return newSet
    })
  }

  const handleSelectAllGuests = (checked: boolean, filteredGuests: Guest[]) => {
    if (checked) {
      setSelectedGuestIds(new Set(filteredGuests.map(g => g.id)))
    } else {
      setSelectedGuestIds(new Set())
    }
  }

  const handleBulkAssignSubEvents = async (subEventIds: number[], action: 'assign' | 'deassign') => {
    if (selectedGuestIds.size === 0) {
      showToast('Please select at least one guest', 'error')
      return
    }

    if (subEventIds.length === 0) {
      showToast('Please select at least one sub-event', 'error')
      return
    }

    // Filter selected guest IDs to only include guests that exist in the current event's guest list
    // This ensures we don't accidentally include guests from other events or invalid IDs
    const validGuestIds = Array.from(selectedGuestIds).filter(guestId => {
      // Check if the guest exists in the current event's guest list
      return guests.some(g => g.id === guestId)
    })

    if (validGuestIds.length === 0) {
      showToast('No valid guests selected for this event', 'error')
      return
    }

    if (validGuestIds.length !== selectedGuestIds.size) {
      showToast(`Warning: ${selectedGuestIds.size - validGuestIds.length} invalid guest(s) were excluded`, 'info')
    }

    try {
      const response = await api.post('/api/events/guest-invites/bulk-assign/', {
        guest_ids: validGuestIds,
        sub_event_ids: subEventIds,
        action: action
      })

      showToast(response.data.message || `Successfully ${action}ed sub-events`, 'success')
      setSelectedGuestIds(new Set())
      setBulkSelectedSubEventIds(new Set())
      setShowBulkSubEventAssignment(false)
      
      // Refresh guests to get updated assignments
      await fetchGuests()
    } catch (error: any) {
      logError('Failed to bulk assign sub-events:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || `Failed to ${action} sub-events`
      console.error('Bulk assign error details:', {
        status: error.response?.status,
        data: error.response?.data,
        guest_ids: validGuestIds,
        sub_event_ids: subEventIds,
        action: action
      })
      showToast(errorMessage, 'error')
    }
  }

  const handleCopyGuestLink = async (guest: Guest) => {
    if (!event || !guest.guest_token) {
      showToast('Guest token not available yet. Please refresh and try again.', 'error')
      return
    }
    
    const guestLink = `${window.location.origin}/invite/${event.slug}?g=${guest.guest_token}`
    
    try {
      await navigator.clipboard.writeText(guestLink)
      setCopiedGuestId(guest.id)
      showToast('Guest-specific link copied to clipboard!', 'success')
      setTimeout(() => setCopiedGuestId(null), 2000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = guestLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedGuestId(guest.id)
      showToast('Guest-specific link copied to clipboard!', 'success')
      setTimeout(() => setCopiedGuestId(null), 2000)
    }
  }

  const onSubmit = async (data: GuestForm) => {
    try {
      // Format phone with country code
      const countryCode = data.country_code || event?.country_code || '+91'
      const formattedPhone = formatPhoneWithCountryCode(data.phone, countryCode)
      
      if (editingGuest) {
        // Update existing guest
        // Use PATCH because backend treats PUT as a full update (would require fields like `event`)
        await api.patch(`/api/events/${eventId}/guests/${editingGuest.id}/`, {
          ...data,
          phone: formattedPhone,
          country_code: countryCode,
          custom_fields: data.custom_fields || {},
        })
        showToast('Guest updated successfully', 'success')
        setEditingGuest(null)
      } else {
        // Create new guest
        const response = await api.post(`/api/events/${eventId}/guests/`, {
          guests: [{
            ...data,
            phone: formattedPhone,
            country_code: countryCode,
            custom_fields: data.custom_fields || {},
          }],
        })
        
        // Check if there were errors (duplicate phone, etc.)
        if (response.data.errors && response.data.errors.length > 0) {
          showToast(response.data.errors[0], 'error')
          return
        }
        showToast('Guest added successfully', 'success')
      }
      
      reset()
      setShowForm(false)
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 
                      (error.response?.data?.errors ? error.response.data.errors[0] : 'Failed to save guest')
      showToast(errorMsg, 'error')
    }
  }

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest)
    // Pre-populate form with guest data
    // Use local_number if available, otherwise extract from phone
    let localPhone = guest.local_number || ''
    
    // If local_number is not available, extract from phone
    if (!localPhone && guest.phone) {
      const phoneDigits = guest.phone.replace(/\D/g, '')
      const countryCode = guest.country_code || event?.country_code || '+91'
      const codeDigits = countryCode.replace('+', '')
      
      // Remove country code from phone if present
      if (phoneDigits.startsWith(codeDigits)) {
        localPhone = phoneDigits.slice(codeDigits.length)
      } else {
        // If country code not found at start, use the phone as is (might be just local number)
        localPhone = phoneDigits
      }
    }
    
    // Determine country code and ISO for the form
    const countryCode = guest.country_code || event?.country_code || '+91'
    const countryIso = guest.country_iso || ''
    
    reset({
      name: guest.name,
      phone: localPhone,
      country_code: countryCode,
      country_iso: countryIso,
      email: guest.email || '',
      relationship: guest.relationship || '',
      notes: guest.notes || '',
      custom_fields: guest.custom_fields || {},
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setEditingGuest(null)
    reset()
    setShowForm(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post(
        `/api/events/${eventId}/guests/import/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      if (response.data.errors && response.data.errors.length > 0) {
        const errorCount = response.data.errors.length
        const createdCount = response.data.created || 0
        
        // Store errors and summary for modal display
        setImportErrors(response.data.errors)
        setImportSummary({ created: createdCount, errors: errorCount })
        
        // Show summary toast
        let errorMsg = ''
        if (createdCount > 0) {
          errorMsg = `✅ ${createdCount} guest(s) imported. ⚠️ ${errorCount} row(s) skipped. Click to see details.`
        } else {
          errorMsg = `❌ Import failed: ${errorCount} error(s). Click to see details.`
        }
        
        showToast(errorMsg, createdCount > 0 ? 'info' : 'error')
      } else {
        showToast(`Successfully imported ${response.data.created} guests`, 'success')
        setImportErrors(null)
        setImportSummary(null)
      }
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to import file',
        'error'
      )
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
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
    } catch (error: any) {
      showToast('Failed to export CSV', 'error')
    }
  }

  const handleDelete = async (guestId: number) => {
    const guest = guests.find(g => g.id === guestId)
    const hasRSVP = guest?.rsvp_status !== null
    
    const message = hasRSVP
      ? 'Are you sure you want to remove this guest? They will not be able to update their RSVP, but the record will be preserved.'
      : 'Are you sure you want to delete this guest from the list?'
    
    if (!confirm(message)) {
      return
    }

    try {
      const response = await api.delete(`/api/events/${eventId}/guests/${guestId}/`)
      const message = response.data.soft_delete
        ? 'Guest removed (soft delete). Record preserved.'
        : 'Guest deleted successfully'
      showToast(message, 'success')
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to remove guest',
        'error'
      )
    }
  }

  const handleReinstateGuest = async (guestId: number) => {
    try {
      await api.post(`/api/events/${eventId}/guests/${guestId}/reinstate/`)
      showToast('Guest reinstated successfully', 'success')
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to reinstate guest',
        'error'
      )
    }
  }

  const handleRemoveRSVP = async (rsvpId: number) => {
    if (!confirm('Are you sure you want to remove this RSVP? The record will be preserved but will not appear in active lists.')) {
      return
    }

    try {
      await api.delete(`/api/events/${eventId}/rsvps/${rsvpId}/`)
      showToast('RSVP removed successfully', 'success')
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to remove RSVP',
        'error'
      )
    }
  }

  const handleReinstateRSVP = async (rsvpId: number) => {
    try {
      await api.post(`/api/events/${eventId}/rsvps/${rsvpId}/reinstate/`)
      showToast('RSVP reinstated successfully', 'success')
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to reinstate RSVP',
        'error'
      )
    }
  }

  const handleToggleInvitationSent = async (guestId: number, newValue: boolean) => {
    try {
      const updateData: any = {
        invitation_sent: newValue,
      }
      
      // If checking, set timestamp; if unchecking, clear timestamp
      if (newValue) {
        updateData.invitation_sent_at = new Date().toISOString()
      } else {
        updateData.invitation_sent_at = null
      }
      
      await api.patch(`/api/events/${eventId}/guests/${guestId}/`, updateData)
      showToast(`Invitation status updated`, 'success')
      // Wait a moment for backend to process, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      await fetchGuests()
      await fetchAnalytics()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to update invitation status',
        'error'
      )
      logError('Failed to toggle invitation_sent:', error)
    }
  }

  const handleShareWhatsApp = (guest: Guest) => {
    if (!event) return
    setSelectedGuest(guest)
    setShowTemplateSelector(true)
  }

  const handleTemplateSelected = async (template: WhatsAppTemplate | null) => {
    if (!event || !selectedGuest) return
    
    setShowTemplateSelector(false)
    setSharingWhatsApp(selectedGuest.id)
    
    try {
      // Generate guest-specific event URL with token if available
      const eventUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/invite/${event.slug || eventId}${selectedGuest.guest_token ? `?g=${selectedGuest.guest_token}` : ''}` 
        : ''
      
      let message: string
      
      if (template) {
        // Use selected template
        let mapDirection: string | undefined
        if (event.city) {
          const encodedLocation = encodeURIComponent(event.city)
          mapDirection = `https://maps.google.com/?q=${encodedLocation}`
        }
        
        const result = replaceTemplateVariables(template.template_text, {
          name: selectedGuest.name,
          event_title: event.title || 'Event',
          event_date: event.date,
          event_location: event.city || '',
          event_url: eventUrl,
          host_name: event.host_name || undefined,
          map_direction: mapDirection,
          custom_fields: (selectedGuest as any).custom_fields || {},
        })
        message = result
        
        // Increment usage count
        try {
          await incrementWhatsAppTemplateUsage(template.id)
        } catch (error) {
          // Silently fail - usage tracking is not critical
          logError('Failed to increment template usage:', error)
        }
      } else {
        // Use event default template
        message = generateGuestMessage(
          selectedGuest.name,
          event.title || 'Event',
          event.date,
          eventUrl,
          event.host_name || undefined, // Host name
          event.city || '', // Event location
          (event as any).whatsapp_message_template // Custom template
        )
      }
      
      const whatsappUrl = generateWhatsAppLink(selectedGuest.phone, message)
      openWhatsApp(whatsappUrl)
      showToast(`Opening WhatsApp to ${selectedGuest.name}...`, 'success')
      
      // Auto-check invitation_sent after WhatsApp opens
      try {
        await api.patch(`/api/events/${eventId}/guests/${selectedGuest.id}/`, {
          invitation_sent: true,
          invitation_sent_at: new Date().toISOString(),
        })
        // Refresh guest list to show updated checkbox
        // Wait a moment for backend to process, then fetch fresh data
        await new Promise(resolve => setTimeout(resolve, 100))
        await fetchGuests()
        await fetchAnalytics()
      } catch (error: any) {
        // Silently fail - don't block WhatsApp opening if API call fails
        logError('Failed to update invitation_sent:', error)
      }
    } catch (error: any) {
      logError('Failed to share on WhatsApp:', error)
      showToast('Failed to open WhatsApp', 'error')
    } finally {
      setSharingWhatsApp(null)
      setSelectedGuest(null)
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
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
          <Link href={`/host/events/${eventId}`}>
              <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
              Back to Event
            </Button>
          </Link>
            <Link href={`/host/events/${eventId}/communications`}>
              <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                Communications
              </Button>
            </Link>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-eco-green leading-tight">Guest List</h1>
              <p className="text-gray-700 text-sm md:text-base">
                Manage your invited guests. Track who RSVP'd and gave gifts.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap relative w-full md:w-auto md:justify-end">
              {/* Add Guest Button */}
              <Button
                onClick={() => {
                  if (showForm) {
                    handleCancel()
                  } else {
                    setShowForm(true)
                  }
                }}
                className="bg-eco-green hover:bg-green-600 text-white text-sm w-full sm:w-auto whitespace-nowrap"
              >
                {showForm ? 'Cancel' : '+ Add Guest'}
              </Button>

              {/* Custom Fields Manager */}
              <Button
                variant="outline"
                onClick={() => setShowCustomFieldsManager((v) => !v)}
                className="border-eco-green text-eco-green hover:bg-eco-green-light text-sm w-full sm:w-auto whitespace-nowrap"
              >
                Custom Fields
              </Button>
              
              {/* Import/Export Dropdown */}
              <div className="relative" ref={menuRef}>
                <Button
                  variant="outline"
                  onClick={() => setShowImportExportMenu(!showImportExportMenu)}
                  className="border-eco-green text-eco-green hover:bg-eco-green-light flex items-center justify-between gap-2 text-sm w-full sm:w-auto whitespace-nowrap"
                >
                  <span>Bulk Actions</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${showImportExportMenu ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
                
                {showImportExportMenu && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-48 bg-white border-2 border-eco-green-light rounded-md shadow-lg z-50">
                    <button
                      onClick={() => {
                        setShowImportInstructions(true)
                        setShowImportExportMenu(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-eco-green-light flex items-center gap-3 text-sm border-b border-gray-200 transition-colors"
                    >
                      <span className="text-xl">⬆️</span>
                      <span>Import CSV/Excel</span>
                    </button>
                    <button
                      onClick={() => {
                        handleExportCSV()
                        setShowImportExportMenu(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-eco-green-light flex items-center gap-3 text-sm transition-colors"
                    >
                      <span className="text-xl">⬇️</span>
                      <span>Export CSV</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Compact guest engagement summary (click details live on Overview) */}
        {analyticsSummary && (
          <Card className="mb-6 bg-white border-2 border-eco-green-light">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-eco-green text-base">Guest engagement</CardTitle>
                {isMobileViewport && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnalyticsSummary((previous) => !previous)}
                    className="border-eco-green text-eco-green hover:bg-eco-green-light"
                  >
                    {showAnalyticsSummary ? 'Hide' : 'Show'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={isMobileViewport && !showAnalyticsSummary ? 'hidden' : ''}>
              <div className="flex flex-wrap gap-3">
                <div className="text-center p-3 bg-eco-green-light rounded-lg min-w-[80px]">
                  <div className="text-lg font-bold text-eco-green">{analyticsSummary.total_guests}</div>
                  <div className="text-xs text-gray-600">Guests</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg min-w-[80px]">
                  <div className="text-lg font-bold text-blue-600">{analyticsSummary.guests_with_invite_views}</div>
                  <div className="text-xs text-gray-600">Viewed invite</div>
                  <div className="text-xs text-gray-500">{analyticsSummary.invite_view_rate.toFixed(0)}%</div>
                </div>
                {event?.has_rsvp && (
                  <>
                    <div className="text-center p-3 bg-purple-50 rounded-lg min-w-[80px]">
                      <div className="text-lg font-bold text-purple-600">{analyticsSummary.guests_with_rsvp_views}</div>
                      <div className="text-xs text-gray-600">Viewed RSVP</div>
                      <div className="text-xs text-gray-500">{analyticsSummary.rsvp_view_rate.toFixed(0)}%</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg min-w-[80px]">
                      <div className="text-lg font-bold text-green-600">{analyticsSummary.total_invite_views}</div>
                      <div className="text-xs text-gray-600">Invite views</div>
                      <div className="text-xs text-gray-500">{analyticsSummary.total_rsvp_views} RSVP views</div>
                    </div>
                  </>
                )}
                {!event?.has_rsvp && (
                  <div className="text-center p-3 bg-green-50 rounded-lg min-w-[80px]">
                    <div className="text-lg font-bold text-green-600">{analyticsSummary.total_invite_views}</div>
                    <div className="text-xs text-gray-600">Invite views</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {showCustomFieldsManager && (
          <Card className="mb-8 bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">Custom Fields</CardTitle>
              <CardDescription>
                Define additional guest information for this event (used in communications and personalized invite descriptions).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {customFieldsDraft.length === 0 ? (
                  <p className="text-sm text-gray-600">No custom fields yet. Add one below.</p>
                ) : (
                  customFieldsDraft.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Key</label>
                        <Input
                          value={row.key}
                          onChange={(e) => {
                            const next = [...customFieldsDraft]
                            next[idx] = { ...row, key: e.target.value }
                            setCustomFieldsDraft(next)
                          }}
                          placeholder="e.g. allergies"
                        />
                      </div>
                      <div className="col-span-6">
                        <label className="block text-xs text-gray-500 mb-1">Label</label>
                        <Input
                          value={row.display_label}
                          onChange={(e) => {
                            const next = [...customFieldsDraft]
                            next[idx] = { ...row, display_label: e.target.value }
                            setCustomFieldsDraft(next)
                          }}
                          placeholder="e.g. Allergies"
                        />
                      </div>
                      <div className="col-span-2 flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={row.active !== false}
                            onChange={(e) => {
                              const next = [...customFieldsDraft]
                              next[idx] = { ...row, active: e.target.checked }
                              setCustomFieldsDraft(next)
                            }}
                          />
                          Active
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setCustomFieldsDraft((prev) => [
                      ...prev,
                      { id: makeDraftId(), key: '', display_label: '', active: true },
                    ])
                  }
                >
                  + Add Field
                </Button>
                <div className="flex-1" />
                <Button type="button" variant="outline" onClick={() => setShowCustomFieldsManager(false)}>
                  Close
                </Button>
                <Button type="button" className="bg-eco-green hover:bg-green-600 text-white" onClick={handleSaveCustomFields}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <Card className="mb-8 bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">
                {editingGuest ? 'Edit Guest' : 'Add Guest'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <Input {...register('name')} placeholder="Guest name" />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Country Code</label>
                    <CountryCodeSelector
                      name="country_code"
                      value={watch('country_code') || event?.country_code || '+91'}
                      countryIso={watch('country_iso') || undefined}
                      defaultValue={event?.country_code || '+91'}
                      onChange={(value) => {
                        setValue('country_code', value, { shouldValidate: true })
                      }}
                      onCountrySelect={(iso, code) => {
                        setValue('country_code', code, { shouldValidate: true })
                        setValue('country_iso', iso, { shouldValidate: true })
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone *</label>
                    <Input {...register('phone')} placeholder="10-digit phone number" />
                    {errors.phone && (
                      <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Used as unique identifier
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input type="email" {...register('email')} placeholder="email@example.com" />
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Relationship</label>
                  <Input {...register('relationship')} placeholder="e.g., Family, Friends, Colleagues" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    {...register('notes')}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Additional notes"
                  />
                </div>

                {getActiveCustomFields().length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Custom Fields</label>
                    <div className="grid grid-cols-2 gap-4">
                      {getActiveCustomFields().map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs text-gray-500 mb-1">{field.display_label}</label>
                          <Input
                            {...register(`custom_fields.${field.key}` as any)}
                            placeholder={`Enter ${field.display_label.toLowerCase()}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      These can be used as variables like <span className="font-mono">[{getActiveCustomFields()[0].key}]</span> in templates/description.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-eco-green hover:bg-green-600 text-white">
                    {editingGuest ? 'Update Guest' : 'Add Guest'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* CSV Import Instructions - Show only when import is clicked */}
        {showImportInstructions && (
          <Card className="mb-8 bg-white border-2 border-gray-300 shadow-lg">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-800 text-xl">Import Guests from CSV/TXT/Excel</CardTitle>
                <button
                  onClick={() => setShowImportInstructions(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 text-2xl font-light w-8 h-8 flex items-center justify-center rounded transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 py-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-3">File Format Requirements</h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Your CSV, TXT, or Excel file should include the following columns:
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">name</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">phone</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium">email</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium">relationship</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium">notes</span>
                  </div>
                </div>
                
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-sm text-gray-800 mb-2">
                    <strong className="text-yellow-800">Required fields:</strong> <span className="font-mono bg-white px-2 py-0.5 rounded border border-yellow-300 text-yellow-900">name</span> and <span className="font-mono bg-white px-2 py-0.5 rounded border border-yellow-300 text-yellow-900">phone</span>
                  </p>
                  <p className="text-xs text-gray-700">
                    Phone number is used as a unique identifier per event.
                  </p>
                </div>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <p className="text-xs text-gray-700">
                    <strong className="text-blue-800">Note:</strong> If a guest with the same phone number already exists, that row will be skipped during import. You can merge duplicate entries manually if needed.
                  </p>
                </div>
              </div>
              
              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={(e) => {
                    handleFileUpload(e)
                    setShowImportInstructions(false)
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-eco-green hover:bg-green-600 text-white w-full py-3 text-base font-medium shadow-sm"
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>⬆️</span>
                      Choose CSV/Excel File to Upload
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guest List Table */}
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <div>
              <CardTitle className="text-eco-green">
                Invited Guests ({guests.length})
              </CardTitle>
              <CardDescription>
                Guests from this list who RSVP or give gifts will be marked as "Core Guests"
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {/* Toolbar: search + RSVP tabs + filters */}
            <div className="space-y-4">
              {/* Search + RSVP status row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Input
                  type="search"
                  placeholder="Search by guest name..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="w-full sm:max-w-sm border-eco-green-light focus:ring-eco-green focus:border-eco-green"
                  aria-label="Search guests by name"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setRsvpFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      rsvpFilter === 'all'
                        ? 'bg-eco-green text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({guests.filter(g => !g.is_removed).length})
                  </button>
                  <button
                    onClick={() => setRsvpFilter('unconfirmed')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      rsvpFilter === 'unconfirmed'
                        ? 'bg-eco-green text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Unconfirmed ({guests.filter(g => !g.is_removed && !g.rsvp_status && !g.rsvp_will_attend).length})
                  </button>
                  <button
                    onClick={() => setRsvpFilter('confirmed')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      rsvpFilter === 'confirmed'
                        ? 'bg-eco-green text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Confirmed ({guests.filter(g => !g.is_removed && (g.rsvp_status === 'yes' || g.rsvp_will_attend === 'yes')).length})
                  </button>
                  <button
                    onClick={() => setRsvpFilter('no')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      rsvpFilter === 'no'
                        ? 'bg-eco-green text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Declined ({guests.filter(g => !g.is_removed && (g.rsvp_status === 'no' || g.rsvp_will_attend === 'no')).length})
                  </button>
                  {rsvpFilter !== 'all' && (
                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
                      <button
                        onClick={() => setRsvpFilterMode('include')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          rsvpFilterMode === 'include'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Include guests matching this filter"
                      >
                        Include
                      </button>
                      <button
                        onClick={() => setRsvpFilterMode('exclude')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          rsvpFilterMode === 'exclude'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Exclude guests matching this filter"
                      >
                        Exclude
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter row: left group (controls) + right group (Showing, Reset) */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Category</span>
                <select
                  value={categorySource}
                  onChange={(e) => {
                    setCategorySource(e.target.value as any)
                    setCategoryValue('all')
                  }}
                  className="text-sm border rounded px-2 py-1 bg-white"
                >
                  {categorySourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  className="text-sm border rounded px-2 py-1 bg-white"
                >
                  <option value="all">All</option>
                  {categoryValueOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {categoryValue !== 'all' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCategoryFilterMode('include')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        categoryFilterMode === 'include'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Include guests matching this category"
                    >
                      Include
                    </button>
                    <button
                      onClick={() => setCategoryFilterMode('exclude')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        categoryFilterMode === 'exclude'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Exclude guests matching this category"
                    >
                      Exclude
                    </button>
                  </div>
                )}
              </div>

              {event?.event_structure === 'ENVELOPE' && subEvents.length > 0 && (
                <div className="relative flex items-center gap-2" ref={subEventFilterRef}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubEventFilterMenu((v) => !v)}
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    Sub-Events{selectedSubEventFilterIds.size > 0 ? ` (${selectedSubEventFilterIds.size})` : ''}
                  </Button>
                  {selectedSubEventFilterIds.size > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSubEventFilterMode('include')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          subEventFilterMode === 'include'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Include guests assigned to selected sub-events"
                      >
                        Include
                      </button>
                      <button
                        onClick={() => setSubEventFilterMode('exclude')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          subEventFilterMode === 'exclude'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Exclude guests assigned to selected sub-events"
                      >
                        Exclude
                      </button>
                    </div>
                  )}
                  {showSubEventFilterMenu && (
                    <div className="absolute left-0 mt-2 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700">Filter by assigned sub-events</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubEventFilterIds(new Set())
                          }}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-2">
                        {subEvents.map((se) => {
                          const checked = selectedSubEventFilterIds.has(se.id)
                          return (
                            <label key={se.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedSubEventFilterIds((prev) => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(se.id)
                                    else next.delete(se.id)
                                    return next
                                  })
                                }}
                              />
                              <span className="truncate" title={se.title}>
                                {se.title}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" onClick={() => setShowSubEventFilterMenu(false)}>
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Invite sent</span>
                <select
                  value={inviteSentFilter}
                  onChange={(e) => setInviteSentFilter(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1 bg-white"
                >
                  <option value="all">All</option>
                  <option value="sent">Sent</option>
                  <option value="not_sent">Not sent</option>
                </select>
                {inviteSentFilter !== 'all' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setInviteSentFilterMode('include')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        inviteSentFilterMode === 'include'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Include guests matching this invite status"
                    >
                      Include
                    </button>
                    <button
                      onClick={() => setInviteSentFilterMode('exclude')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        inviteSentFilterMode === 'exclude'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Exclude guests matching this invite status"
                    >
                      Exclude
                    </button>
                  </div>
                )}
              </div>

              {/* Columns picker (middle columns only, max 5) */}
              <div className="relative" ref={columnsMenuRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnsMenu((v) => !v)}
                  className="border-gray-300 text-gray-800 hover:bg-gray-50"
                >
                  Columns ({middleColumnsToRender.length}/{MAX_MIDDLE_COLUMNS})
                </Button>
                {showColumnsMenu && (
                  <div className="absolute left-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">Choose middle columns</span>
                      <button
                        type="button"
                        onClick={resetMiddleColumns}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      Selected {middleColumnsToRender.length} / {MAX_MIDDLE_COLUMNS}
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {middleColumnOptions().map((opt) => {
                        const checked = middleColumnsToRender.includes(opt.key)
                        const atLimit = middleColumnsToRender.length >= MAX_MIDDLE_COLUMNS
                        const disabled = !checked && atLimit
                        return (
                          <label
                            key={opt.key}
                            className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleMiddleColumn(opt.key)}
                            />
                            <span className="truncate" title={opt.label}>
                              {opt.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Button type="button" size="sm" onClick={() => setShowColumnsMenu(false)}>
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden sm:block text-xs text-gray-500">
                Tip: click column headers to sort
              </div>

              {/* Mobile fallback */}
              <div className="flex items-center gap-2 sm:hidden">
                <span className="text-xs text-gray-600">Sort</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1 bg-white"
                >
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="category">Category</option>
                  <option value="rsvp_status">RSVP Status</option>
                  <option value="guests_count">Guests Count</option>
                  <option value="invite_sent">Invite sent</option>
                  {event?.event_structure === 'ENVELOPE' && <option value="sub_events_assigned">Sub-events assigned</option>}
                  {event?.event_structure === 'ENVELOPE' && event?.rsvp_mode === 'PER_SUBEVENT' && (
                    <option value="sub_events_attending">Sub-events attending</option>
                  )}
                  <option value="notes">Notes</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  {sortDir === 'asc' ? '↑' : '↓'}
                </Button>
              </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <div className="text-xs text-gray-500">
                    Showing {visibleGuests.length} of {guests.filter(g => !g.is_removed).length}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNameSearch('')
                      setCategorySource('relationship')
                      setCategoryValue('all')
                      setInviteSentFilter('all')
                      setSelectedSubEventFilterIds(new Set())
                      setSortKey('name')
                      setSortDir('asc')
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
            {guests.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-gray-600 mb-4">No guests added yet</p>
                <p className="text-sm text-gray-500 mb-6">
                  Add guests manually or import from CSV/Excel to track RSVPs and gifts
                </p>
                <Button
                  onClick={() => {
                    setEditingGuest(null)
                    reset()
                    setShowForm(true)
                  }}
                  className="bg-eco-green hover:bg-green-600 text-white"
                >
                  Add First Guest
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Bulk Actions Bar - Show when guests are selected and event has subevents */}
                {selectedGuestIds.size > 0 && event?.event_structure === 'ENVELOPE' && subEvents.length > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedGuestIds.size} guest(s) selected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBulkSubEventAssignment(true)}
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        Assign/Deassign Sub-Events
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedGuestIds(new Set())}
                      className="text-blue-700 hover:text-blue-900"
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-12">
                        {(() => {
                          const allSelected =
                            visibleGuests.length > 0 && visibleGuests.every(g => selectedGuestIds.has(g.id))
                          const someSelected = visibleGuests.some(g => selectedGuestIds.has(g.id))
                          
                          return (
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected
                              }}
                              onChange={(e) => handleSelectAllGuests(e.target.checked, visibleGuests)}
                              className="cursor-pointer"
                            />
                          )
                        })()}
                      </th>
                      <th className="text-left p-2">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                          title="Sort by name"
                        >
                          Name{sortArrow('name')}
                        </button>
                      </th>
                      <th className="text-left p-2">Phone</th>

                      {middleColumnsToRender.map((col) => {
                        if (col === 'email') {
                          return (
                            <th key={col} className="text-left p-2">
                              <button
                                type="button"
                                onClick={() => toggleSort('email')}
                                className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                                title="Sort by email"
                              >
                                Email{sortArrow('email')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'relationship') {
                          return (
                            <th key={col} className="text-left p-2">
                              <button
                                type="button"
                                onClick={() => toggleSort('category')}
                                className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                                title="Sort by relationship"
                              >
                                Relationship{sortArrow('category')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'guests_count') {
                          return (
                            <th key={col} className="text-left p-2">
                              <button
                                type="button"
                                onClick={() => toggleSort('guests_count')}
                                className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                                title="Sort by guests count"
                              >
                                Guests Count{sortArrow('guests_count')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'notes') {
                          return (
                            <th key={col} className="text-left p-2">
                              <button
                                type="button"
                                onClick={() => toggleSort('notes')}
                                className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                                title="Sort by notes"
                              >
                                Notes{sortArrow('notes')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'sub_events_attending') {
                          return (
                            <th key={col} className="text-left p-2">
                              <button
                                type="button"
                                onClick={() => toggleSort('sub_events_attending')}
                                className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                                title="Sort by sub-events attending"
                              >
                                {getMiddleColumnLabel(col)}
                                {sortArrow('sub_events_attending')}
                              </button>
                            </th>
                          )
                        }

                        return (
                          <th key={col} className="text-left p-2">
                            {getMiddleColumnLabel(col)}
                          </th>
                        )
                      })}

                      <th className="text-left p-2">
                        <button
                          type="button"
                          onClick={() => toggleSort('rsvp_status')}
                          className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                          title="Sort by RSVP status"
                        >
                          RSVP Status{sortArrow('rsvp_status')}
                        </button>
                      </th>

                      <th className="text-left p-2">
                        <div className="flex flex-col gap-1" title="Tracks how many times the guest viewed their invite page and RSVP page">
                          <span className="text-xs font-medium text-gray-700">Page Views</span>
                          <span className="text-xs text-gray-500">Invite • RSVP</span>
                        </div>
                      </th>

                      <th className="text-left p-2">
                        <button
                          type="button"
                          onClick={() => toggleSort('invite_sent')}
                          className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                          title="Sort by invite sent"
                        >
                          Invitation Sent{sortArrow('invite_sent')}
                        </button>
                      </th>

                      {event?.event_structure === 'ENVELOPE' && (
                        <th className="text-left p-2">
                          <button
                            type="button"
                            onClick={() => toggleSort('sub_events_assigned')}
                            className="inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
                            title="Sort by sub-events assigned"
                          >
                            Sub-Events{sortArrow('sub_events_assigned')}
                          </button>
                        </th>
                      )}
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (visibleGuests.length === 0) {
                        return (
                          <tr>
                            <td colSpan={tableColSpan} className="p-8 text-center text-gray-500">
                              {rsvpFilter === 'unconfirmed' && 'No unconfirmed guests'}
                              {rsvpFilter === 'confirmed' && 'No confirmed guests'}
                              {rsvpFilter === 'no' && 'No declined guests'}
                              {rsvpFilter === 'all' && 'No guests yet'}
                            </td>
                          </tr>
                        )
                      }
                      
                      return visibleGuests.map((guest) => {
                        // Get analytics data - prefer from guest object, fallback to analyticsData state
                        const analytics = analyticsData[guest.id] || {}
                        const inviteViewsCount = guest.invite_views_count ?? analytics.invite_views_count ?? 0
                        const rsvpViewsCount = guest.rsvp_views_count ?? analytics.rsvp_views_count ?? 0
                        const lastInviteView = guest.last_invite_view ?? analytics.last_invite_view ?? null
                        const lastRsvpView = guest.last_rsvp_view ?? analytics.last_rsvp_view ?? null
                        const hasViewedInvite = guest.has_viewed_invite ?? analytics.has_viewed_invite ?? false
                        const hasViewedRsvp = guest.has_viewed_rsvp ?? analytics.has_viewed_rsvp ?? false
                        
                        const getRsvpStatusBadge = (status: string | null) => {
                        if (!status) {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Pending
                            </span>
                          )
                        }
                        const statusConfig = {
                          yes: { label: 'Yes', className: 'bg-green-100 text-green-700' },
                          no: { label: 'No', className: 'bg-red-100 text-red-700' },
                          maybe: { label: 'Maybe', className: 'bg-yellow-100 text-yellow-700' },
                        }
                        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.yes
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
                            {config.label}
                          </span>
                        )
                      }
                      
                      return (
                        <tr key={guest.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedGuestIds.has(guest.id)}
                              onChange={() => handleToggleGuestSelection(guest.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="p-2 font-medium">{guest.name}</td>
                          <td className="p-2 text-sm text-gray-600 font-mono">{getDisplayPhone(guest)}</td>

                          {middleColumnsToRender.map((col) => {
                            if (col === 'email') {
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600">
                                  {guest.email || '-'}
                                </td>
                              )
                            }
                            if (col === 'relationship') {
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600">
                                  {guest.relationship || '-'}
                                </td>
                              )
                            }
                            if (col === 'guests_count') {
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600">
                                  {guest.rsvp_guests_count !== null && guest.rsvp_guests_count !== undefined
                                    ? guest.rsvp_guests_count
                                    : '-'}
                                </td>
                              )
                            }
                            if (col === 'notes') {
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600">
                                  {guest.notes || '-'}
                                </td>
                              )
                            }
                            if (col === 'sub_events_attending') {
                              const rsvps = guestRSVPs[guest.id] || []
                              const attendingSubEvents = rsvps
                                .filter((r: any) => r.will_attend === 'yes' && r.sub_event_title)
                                .map((r: any) => r.sub_event_title)

                              return (
                                <td key={col} className="p-2">
                                  {attendingSubEvents.length === 0 ? (
                                    <span className="text-xs text-gray-400">-</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {attendingSubEvents.map((title: string, idx: number) => (
                                        <span key={idx} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                          {title}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              )
                            }
                            if (col.startsWith('cf:')) {
                              const key = col.slice(3)
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600">
                                  {guest.custom_fields?.[key] || '-'}
                                </td>
                              )
                            }
                            return (
                              <td key={col} className="p-2 text-sm text-gray-600">
                                -
                              </td>
                            )
                          })}

                          <td className="p-2">{getRsvpStatusBadge(guest.rsvp_status || guest.rsvp_will_attend)}</td>

                          <td className="p-2">
                            <div className="flex flex-col gap-2 text-xs">
                              <div 
                                className="flex items-center gap-2 group relative cursor-help"
                                title={`Invite Page Views: ${inviteViewsCount}${lastInviteView ? `\nLast Viewed: ${new Date(lastInviteView).toLocaleString()}` : '\nNever viewed'}`}
                              >
                                <div className={`flex items-center gap-1 min-w-[60px] ${hasViewedInvite ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  <span className="font-medium">{inviteViewsCount}</span>
                                </div>
                                <span className="text-gray-600 text-[10px]">Invite</span>
                                {lastInviteView && (
                                  <span 
                                    className="text-gray-400 text-[10px]"
                                    title={`Last viewed: ${new Date(lastInviteView).toLocaleString()}`}
                                  >
                                    {new Date(lastInviteView).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <div 
                                className="flex items-center gap-2 group relative cursor-help"
                                title={`RSVP Page Views: ${rsvpViewsCount}${lastRsvpView ? `\nLast Viewed: ${new Date(lastRsvpView).toLocaleString()}` : '\nNever viewed'}`}
                              >
                                <div className={`flex items-center gap-1 min-w-[60px] ${hasViewedRsvp ? 'text-purple-600 font-semibold' : 'text-gray-400'}`}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium">{rsvpViewsCount}</span>
                                </div>
                                <span className="text-gray-600 text-[10px]">RSVP</span>
                                {lastRsvpView && (
                                  <span 
                                    className="text-gray-400 text-[10px]"
                                    title={`Last viewed: ${new Date(lastRsvpView).toLocaleString()}`}
                                  >
                                    {new Date(lastRsvpView).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="p-2">
                            <div className="flex flex-col items-start gap-1">
                              <input
                                type="checkbox"
                                checked={guest.invitation_sent || false}
                                onChange={() => handleToggleInvitationSent(guest.id, !guest.invitation_sent)}
                                className="cursor-pointer"
                                disabled={sharingWhatsApp === guest.id}
                              />
                              {guest.invitation_sent_at && (
                                <span className="text-xs text-gray-500">
                                  {new Date(guest.invitation_sent_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </td>
                          {event?.event_structure === 'ENVELOPE' && (
                            <td className="p-2">
                              <Button
                                variant="outline"
                                size="sm"
                                 onClick={async () => {
                                   // Ensure assignments are loaded before opening modal
                                   if (guestSubEventAssignments[guest.id] === undefined) {
                                     // If guest has sub_event_invites from fetchGuests, use that
                                     if (guest.sub_event_invites && Array.isArray(guest.sub_event_invites)) {
                                       setGuestSubEventAssignments(prev => ({
                                         ...prev,
                                         [guest.id]: guest.sub_event_invites!
                                       }))
                                     } else {
                                       // Otherwise fetch from API
                                       await fetchGuestSubEventAssignments(guest.id)
                                     }
                                   }
                                   setShowSubEventAssignment(guest.id)
                                 }}
                                className="text-xs border-purple-300 text-purple-600 hover:bg-purple-50"
                              >
                                {guestSubEventAssignments[guest.id]?.length || 0} assigned
                              </Button>
                            </td>
                          )}
                          <td className="p-2">
                            <div className="flex gap-2 flex-wrap">
                              {guest.guest_token && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyGuestLink(guest)}
                                  className="text-xs border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                                  title="Copy guest-specific invite link"
                                >
                                  {copiedGuestId === guest.id ? '✓ Copied' : 'Copy Link'}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShareWhatsApp(guest)}
                                disabled={sharingWhatsApp === guest.id}
                                className="text-xs border-green-300 text-green-600 hover:bg-green-50 flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                {sharingWhatsApp === guest.id ? 'Opening...' : 'WhatsApp'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(guest)}
                                className="text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(guest.id)}
                                className="text-xs border-red-300 text-red-600 hover:bg-red-50"
                              >
                                {guest.rsvp_status || guest.rsvp_will_attend ? 'Remove' : 'Delete'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                    })()}
                    {/* Removed Guests at Bottom */}
                    {removedGuestsList.length > 0 && (
                      <>
                        {removedGuestsList.map((guest) => (
                          <tr key={guest.id} className="border-b bg-gray-50 opacity-60">
                            <td className="p-2" />
                            <td className="p-2 font-medium text-gray-500">
                              {guest.name} <span className="text-xs text-gray-400">(Removed)</span>
                            </td>
                            <td className="p-2 text-sm text-gray-500 font-mono">{getDisplayPhone(guest)}</td>

                            {middleColumnsToRender.map((col) => {
                              if (col === 'email') {
                                return (
                                  <td key={col} className="p-2 text-sm text-gray-500">
                                    {guest.email || '-'}
                                  </td>
                                )
                              }
                              if (col === 'relationship') {
                                return (
                                  <td key={col} className="p-2 text-sm text-gray-500">
                                    {guest.relationship || '-'}
                                  </td>
                                )
                              }
                              if (col === 'guests_count') {
                                return (
                                  <td key={col} className="p-2 text-sm text-gray-500">
                                    {guest.rsvp_guests_count !== null && guest.rsvp_guests_count !== undefined
                                      ? guest.rsvp_guests_count
                                      : '-'}
                                  </td>
                                )
                              }
                              if (col === 'notes') {
                                return (
                                  <td key={col} className="p-2 text-sm text-gray-500">
                                    {guest.notes || '-'}
                                  </td>
                                )
                              }
                              if (col === 'sub_events_attending') {
                                const rsvps = guestRSVPs[guest.id] || []
                                const attendingSubEvents = rsvps
                                  .filter((r: any) => r.will_attend === 'yes' && r.sub_event_title)
                                  .map((r: any) => r.sub_event_title)
                                return (
                                  <td key={col} className="p-2">
                                    {attendingSubEvents.length === 0 ? (
                                      <span className="text-xs text-gray-400">-</span>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {attendingSubEvents.map((title: string, idx: number) => (
                                          <span key={idx} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                                            {title}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                )
                              }
                              if (col.startsWith('cf:')) {
                                const key = col.slice(3)
                                return (
                                  <td key={col} className="p-2 text-sm text-gray-500">
                                    {guest.custom_fields?.[key] || '-'}
                                  </td>
                                )
                              }
                              return (
                                <td key={col} className="p-2 text-sm text-gray-500">
                                  -
                                </td>
                              )
                            })}

                            <td className="p-2">
                              {guest.rsvp_status || guest.rsvp_will_attend ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                  {guest.rsvp_status || guest.rsvp_will_attend}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-2 text-sm text-gray-500">
                              <div className="flex flex-col items-start gap-1">
                                <input
                                  type="checkbox"
                                  checked={guest.invitation_sent || false}
                                  onChange={() => handleToggleInvitationSent(guest.id, !guest.invitation_sent)}
                                  className="cursor-pointer opacity-60"
                                />
                                {guest.invitation_sent_at && (
                                  <span className="text-xs text-gray-400">
                                    {new Date(guest.invitation_sent_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>
                            </td>
                            {event?.event_structure === 'ENVELOPE' && (
                              <td className="p-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="text-xs border-purple-300 text-purple-600 hover:bg-purple-50 opacity-60"
                                >
                                  {getAssignedSubEventIds(guest).length} assigned
                                </Button>
                              </td>
                            )}
                            <td className="p-2">
                              <Button
                                variant="outline"
                                onClick={() => handleReinstateGuest(guest.id)}
                                className="border-green-300 text-green-600 hover:bg-green-50 text-xs"
                              >
                                Include
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        {/* Other Guests Table - RSVPs from people not in guest list */}
        {(otherGuests.length > 0 || removedGuests.length > 0) && (
          <Card className="bg-white border-2 border-eco-green-light mt-8">
            <CardHeader>
              <CardTitle className="text-eco-green">
                Other Guests ({otherGuests.filter(g => !g.is_removed).length})
                {removedGuests.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({removedGuests.length} removed)
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                People who RSVP'd but weren't in your original guest list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Country Code</th>
                      <th className="text-left p-2">Phone Number</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">RSVP Status</th>
                      <th className="text-left p-2">Guests Count</th>
                      <th className="text-left p-2">Source</th>
                      <th className="text-left p-2">Notes</th>
                      <th className="text-left p-2">RSVP Date</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherGuests.filter(g => !g.is_removed).map((guest) => {
                      const getRsvpStatusBadge = (status: string) => {
                        const statusConfig = {
                          yes: { label: 'Yes', className: 'bg-green-100 text-green-700' },
                          no: { label: 'No', className: 'bg-red-100 text-red-700' },
                          maybe: { label: 'Maybe', className: 'bg-yellow-100 text-yellow-700' },
                        }
                        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.yes
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
                            {config.label}
                          </span>
                        )
                      }
                      
                      const getSourceBadge = (source: string) => {
                        const sourceConfig = {
                          qr: { label: 'QR Code', className: 'bg-purple-100 text-purple-700' },
                          link: { label: 'Web Link', className: 'bg-blue-100 text-blue-700' },
                          manual: { label: 'Manual', className: 'bg-gray-100 text-gray-700' },
                        }
                        const config = sourceConfig[source as keyof typeof sourceConfig] || sourceConfig.link
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
                            {config.label}
                          </span>
                        )
                      }
                      
                      return (
                        <tr key={guest.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{guest.name}</td>
                          <td className="p-2 text-sm text-gray-700 font-mono">
                            {guest.country_code || '-'}
                          </td>
                          <td className="p-2 text-sm text-gray-600 font-mono">
                            {guest.local_number || guest.phone || '-'}
                          </td>
                          <td className="p-2 text-sm text-gray-600">{guest.email || '-'}</td>
                          <td className="p-2">
                            {getRsvpStatusBadge(guest.will_attend)}
                          </td>
                          <td className="p-2 text-sm text-gray-600">{guest.guests_count || 1}</td>
                          <td className="p-2">
                            {getSourceBadge(guest.source_channel)}
                          </td>
                          <td className="p-2 text-sm text-gray-600">{guest.notes || '-'}</td>
                          <td className="p-2 text-sm text-gray-600">
                            {new Date(guest.created_at).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="p-2">
                            <Button
                              variant="outline"
                              onClick={() => handleRemoveRSVP(guest.id)}
                              className="border-red-300 text-red-600 hover:bg-red-50 text-xs"
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                    {/* Removed Other Guests at Bottom */}
                    {removedGuests.map((guest) => (
                      <tr key={guest.id} className="border-b bg-gray-50 opacity-60">
                        <td className="p-2 font-medium text-gray-500">{guest.name} <span className="text-xs text-gray-400">(Removed)</span></td>
                        <td className="p-2 text-sm text-gray-500 font-mono">{guest.country_code || '-'}</td>
                        <td className="p-2 text-sm text-gray-500 font-mono">{guest.local_number || guest.phone || '-'}</td>
                        <td className="p-2 text-sm text-gray-500">{guest.email || '-'}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                            {guest.will_attend}
                          </span>
                        </td>
                        <td className="p-2 text-sm text-gray-500">{guest.guests_count || 1}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                            {guest.source_channel}
                          </span>
                        </td>
                        <td className="p-2 text-sm text-gray-500">{guest.notes || '-'}</td>
                        <td className="p-2 text-sm text-gray-500">
                          {new Date(guest.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="p-2">
                          <Button
                            variant="outline"
                            onClick={() => handleReinstateRSVP(guest.id)}
                            className="border-green-300 text-green-600 hover:bg-green-50 text-xs"
                          >
                            Include
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Errors Modal */}
        {importErrors && importSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <CardHeader>
                <CardTitle className="text-eco-green">Import Summary</CardTitle>
                <CardDescription>
                  {importSummary.created > 0 
                    ? `${importSummary.created} guest(s) imported successfully`
                    : 'No guests were imported'}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[60vh]">
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-700">{importSummary.created}</div>
                      <div className="text-sm text-green-600">Successfully Imported</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="text-2xl font-bold text-red-700">{importSummary.errors}</div>
                      <div className="text-sm text-red-600">Rows Skipped</div>
                    </div>
                  </div>
                </div>
                
                {importErrors.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-700">Errors ({importErrors.length}):</h3>
                    <div className="space-y-1">
                      {importErrors.map((error, idx) => (
                        <div key={idx} className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => {
                      setImportErrors(null)
                      setImportSummary(null)
                    }}
                    className="bg-eco-green hover:bg-green-600 text-white"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bulk Sub-Event Assignment Modal */}
        {showBulkSubEventAssignment && event?.event_structure === 'ENVELOPE' && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowBulkSubEventAssignment(false)
              }
            }}
          >
            <Card className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Bulk Assign/Deassign Sub-Events</CardTitle>
                <CardDescription>
                  Select sub-events to assign or deassign for {selectedGuestIds.size} selected guest(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subEvents.length === 0 ? (
                  <p className="text-gray-600 mb-4">No sub-events available. Create sub-events first.</p>
                ) : (
                  <div className="space-y-3 mb-6">
                    {subEvents.map((subEvent) => (
                      <label
                        key={subEvent.id}
                        className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelectedSubEventIds.has(subEvent.id)}
                          onChange={(e) => {
                            setBulkSelectedSubEventIds(prev => {
                              const newSet = new Set(prev)
                              if (e.target.checked) {
                                newSet.add(subEvent.id)
                              } else {
                                newSet.delete(subEvent.id)
                              }
                              return newSet
                            })
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{subEvent.title}</div>
                          {subEvent.start_at && (
                            <div className="text-sm text-gray-500">
                              {new Date(subEvent.start_at).toLocaleString()}
                            </div>
                          )}
                          {subEvent.location && (
                            <div className="text-sm text-gray-500">{subEvent.location}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBulkSubEventAssignment(false)
                      setBulkSelectedSubEventIds(new Set())
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (bulkSelectedSubEventIds.size === 0) {
                        showToast('Please select at least one sub-event', 'error')
                        return
                      }
                      handleBulkAssignSubEvents(Array.from(bulkSelectedSubEventIds), 'deassign')
                    }}
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    disabled={subEvents.length === 0 || bulkSelectedSubEventIds.size === 0}
                  >
                    Deassign Selected
                  </Button>
                  <Button
                    onClick={() => {
                      if (bulkSelectedSubEventIds.size === 0) {
                        showToast('Please select at least one sub-event', 'error')
                        return
                      }
                      handleBulkAssignSubEvents(Array.from(bulkSelectedSubEventIds), 'assign')
                    }}
                    className="bg-eco-green hover:bg-green-600 text-white"
                    disabled={subEvents.length === 0 || bulkSelectedSubEventIds.size === 0}
                  >
                    Assign Selected
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sub-Event Assignment Modal */}
        {showSubEventAssignment && event?.event_structure === 'ENVELOPE' && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSubEventAssignment(null)
              }
            }}
          >
            <Card className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Assign Sub-Events to Guest</CardTitle>
                <CardDescription>
                  Select which sub-events this guest should see on their invite page
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subEvents.length === 0 ? (
                  <p className="text-gray-600 mb-4">No sub-events available. Create sub-events first.</p>
                ) : (
                  <div className="space-y-3">
                    {subEvents.map((subEvent) => (
                      <label
                        key={subEvent.id}
                        className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={(guestSubEventAssignments[showSubEventAssignment] || []).includes(subEvent.id)}
                          onChange={(e) => {
                            const current = guestSubEventAssignments[showSubEventAssignment] || []
                            const updated = e.target.checked
                              ? [...current, subEvent.id]
                              : current.filter(id => id !== subEvent.id)
                            setGuestSubEventAssignments(prev => ({
                              ...prev,
                              [showSubEventAssignment]: updated
                            }))
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{subEvent.title}</div>
                          {subEvent.start_at && (
                            <div className="text-sm text-gray-500">
                              {new Date(subEvent.start_at).toLocaleString()}
                            </div>
                          )}
                          {subEvent.location && (
                            <div className="text-sm text-gray-500">{subEvent.location}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowSubEventAssignment(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSaveSubEventAssignments(showSubEventAssignment)}
                    className="bg-eco-green hover:bg-green-600 text-white"
                    disabled={subEvents.length === 0}
                  >
                    Save Assignments
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && event && selectedGuest && (
        <TemplateSelector
          eventId={parseInt(eventId)}
          eventTitle={event.title}
          eventDate={event.date}
          eventUrl={typeof window !== 'undefined' ? `${window.location.origin}/invite/${event.slug || eventId}` : ''}
          hostName={undefined}
          eventLocation={event.city}
          guestName={selectedGuest.name}
          guestId={selectedGuest.id}
          guestCustomFields={selectedGuest.custom_fields || {}}
          onSelect={handleTemplateSelected}
          onCancel={() => {
            setShowTemplateSelector(false)
            setSelectedGuest(null)
          }}
        />
      )}
    </div>
  )
}

