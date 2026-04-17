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
import { getSiteUrl } from '@/lib/site-url'
import { WhatsAppTemplate, incrementWhatsAppTemplateUsage } from '@/lib/api'
import { isContactPickerSupported, selectContactsAsGuestRows } from '@/lib/contactPickerImport'
import { isLikelyIOS } from '@/lib/contactImportUi'
import dynamic from 'next/dynamic'
import { Columns2, Filter } from 'lucide-react'

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
  source?: 'manual' | 'file_import' | 'contact_import' | 'api_import' | 'form_submission'
  rsvp_status: string | null
  rsvp_will_attend: string | null
  rsvp_guests_count: number | null
  slot_booking_selected_slot_label?: string | null
  slot_booking_slot_date?: string | null
  slot_booking_status?: 'confirmed' | null
  rsvp_notes?: string | null
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
  rsvp_experience_mode?: 'standard' | 'sub_event' | 'slot_based'
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
  const [guestTab, setGuestTab] = useState<'all' | 'invited' | 'direct' | 'attending' | 'declined' | 'slot_booked' | 'no_response'>('all')
  type CategorySource = 'relationship' | `cf:${string}`
  const [categorySource, setCategorySource] = useState<CategorySource>('relationship')
  const [categoryValue, setCategoryValue] = useState<string>('all')
  const [categoryFilterMode, setCategoryFilterMode] = useState<'include' | 'exclude'>('include')
  const [inviteSentFilter, setInviteSentFilter] = useState<'all' | 'sent' | 'not_sent'>('all')
  const [inviteSentFilterMode, setInviteSentFilterMode] = useState<'include' | 'exclude'>('include')
  const [selectedSubEventFilterIds, setSelectedSubEventFilterIds] = useState<Set<number>>(new Set())
  const [subEventFilterMode, setSubEventFilterMode] = useState<'include' | 'exclude'>('include')
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const filtersPanelRef = useRef<HTMLDivElement>(null)

  // Column visibility (host configurable, middle-only)
  type MiddleColumnKey =
    | 'email'
    | 'relationship'
    | 'guests_count'
    | 'notes'
    | 'slot_selected'
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
  const [showImportGuestsModal, setShowImportGuestsModal] = useState(false)
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
  const [openRowActionsGuestId, setOpenRowActionsGuestId] = useState<number | null>(null)
  const bulkActionsMenuRef = useRef<HTMLDivElement>(null)
  const [showBulkActionsMenu, setShowBulkActionsMenu] = useState(false)
  const hasInitializedFiltersRef = useRef(false)
  const contactPickerSupported = useMemo(() => isContactPickerSupported(), [])
  const isSlotBasedEvent = event?.rsvp_experience_mode === 'slot_based'

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
        const polledGuests = normalizeAnalyticsGuests(analyticsResponse)
        
        // Compare with current analytics data (from ref) to detect changes
        const currentAnalyticsData = analyticsDataRef.current
        let hasChanges = false
        
        // Check each guest for changes
        polledGuests.forEach((guest: GuestAnalytics) => {
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
          if (!polledGuests.find(g => g.id === parseInt(guestId))) {
            hasChanges = true
          }
        })
        
        // If changes detected, refresh analytics (which will update state and merge into guests)
        if (hasChanges) {
          console.log('[Analytics] Detected changes in analytics data, refreshing UI...', {
            guests_checked: polledGuests.length,
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
      if (bulkActionsMenuRef.current && !bulkActionsMenuRef.current.contains(event.target as Node)) {
        setShowBulkActionsMenu(false)
      }
      if (filtersPanelRef.current && !filtersPanelRef.current.contains(event.target as Node)) {
        setShowFiltersPanel(false)
      }
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(event.target as Node)) {
        setShowColumnsMenu(false)
      }
      if (openRowActionsGuestId != null) {
        const root = (event.target as HTMLElement).closest('[data-row-actions-root]')
        if (!root || root.getAttribute('data-guest-id') !== String(openRowActionsGuestId)) {
          setOpenRowActionsGuestId(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openRowActionsGuestId])

  useEffect(() => {
    if (openRowActionsGuestId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenRowActionsGuestId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openRowActionsGuestId])

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

  // Ensure slot-selected column is available for slot-based RSVP events.
  useEffect(() => {
    if (!isSlotBasedEvent) return
    setVisibleMiddleColumns(prev => {
      if (prev.includes('slot_selected')) return prev
      if (prev.length >= MAX_MIDDLE_COLUMNS) return prev
      return [...prev, 'slot_selected']
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSlotBasedEvent])

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

    // Unified guest tabs
    if (guestTab === 'invited') {
      list = list.filter(g => g.source !== 'form_submission')
    } else if (guestTab === 'direct') {
      list = list.filter(g => g.source === 'form_submission')
    } else if (guestTab === 'attending') {
      list = list.filter(g => g.rsvp_status === 'yes' || g.rsvp_will_attend === 'yes')
    } else if (guestTab === 'declined') {
      list = list.filter(g => g.rsvp_status === 'no' || g.rsvp_will_attend === 'no')
    } else if (guestTab === 'slot_booked') {
      list = list.filter(g => g.slot_booking_status === 'confirmed')
    } else if (guestTab === 'no_response') {
      list = list.filter(g => !g.rsvp_status && !g.rsvp_will_attend)
    }

    // RSVP status filter
    if (guestTab === 'all' && rsvpFilter !== 'all') {
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
    guestTab,
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
    if (isSlotBasedEvent) {
      setVisibleMiddleColumns(['email', 'relationship', 'guests_count', 'slot_selected', 'notes'])
    } else {
      setVisibleMiddleColumns(['email', 'relationship', 'guests_count', 'notes'])
    }
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
    if (col === 'slot_selected') return 'Slot Booked'
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

    if (event?.rsvp_experience_mode === 'slot_based') {
      opts.push({ key: 'slot_selected', label: 'Slot Booked' })
    }

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

  const refinementFilterCount = useMemo(() => {
    let n = 0
    if (categorySource !== 'relationship' || categoryValue !== 'all') n++
    if (inviteSentFilter !== 'all') n++
    if (selectedSubEventFilterIds.size > 0) n++
    if (guestTab === 'all' && rsvpFilter !== 'all') n++
    return n
  }, [
    categorySource,
    categoryValue,
    inviteSentFilter,
    selectedSubEventFilterIds,
    guestTab,
    rsvpFilter,
  ])

  const hasSomethingToReset = useMemo(() => {
    if (nameSearch.trim()) return true
    if (categorySource !== 'relationship' || categoryValue !== 'all') return true
    if (categoryFilterMode === 'exclude') return true
    if (inviteSentFilter !== 'all') return true
    if (inviteSentFilterMode === 'exclude') return true
    if (selectedSubEventFilterIds.size > 0) return true
    if (subEventFilterMode === 'exclude') return true
    if (guestTab === 'all' && rsvpFilter !== 'all') return true
    if (rsvpFilterMode === 'exclude') return true
    if (sortKey !== 'name' || sortDir !== 'asc') return true
    return false
  }, [
    nameSearch,
    categorySource,
    categoryValue,
    categoryFilterMode,
    inviteSentFilter,
    inviteSentFilterMode,
    selectedSubEventFilterIds,
    subEventFilterMode,
    guestTab,
    rsvpFilter,
    rsvpFilterMode,
    sortKey,
    sortDir,
  ])

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

  const normalizeAnalyticsGuests = (payload: any): GuestAnalytics[] => {
    if (Array.isArray(payload?.guests)) return payload.guests
    if (Array.isArray(payload?.results)) return payload.results
    if (Array.isArray(payload)) return payload
    return []
  }

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingAnalytics(true)
      }
      const [analyticsResponse, summaryResponse] = await Promise.all([
        getGuestsAnalytics(parseInt(eventId)),
        getEventAnalyticsSummary(parseInt(eventId))
      ])
      const analyticsGuests = normalizeAnalyticsGuests(analyticsResponse)
      
      // Create a map of guest ID to analytics data
      const analyticsMap: Record<number, GuestAnalytics> = {}
      analyticsGuests.forEach((guest: GuestAnalytics) => {
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

  const applyImportResponse = async (data: { created?: number; errors?: string[] }) => {
    const createdCount = data.created ?? 0
    if (data.errors && data.errors.length > 0) {
      const errorCount = data.errors.length
      setImportErrors(data.errors)
      setImportSummary({ created: createdCount, errors: errorCount })
      const errorMsg =
        createdCount > 0
          ? `✅ ${createdCount} guest(s) imported. ⚠️ ${errorCount} row(s) skipped. Click to see details.`
          : `❌ Import failed: ${errorCount} error(s). Click to see details.`
      showToast(errorMsg, createdCount > 0 ? 'info' : 'error')
    } else {
      showToast(`Successfully imported ${createdCount} guest(s)`, 'success')
      setImportErrors(null)
      setImportSummary(null)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    await fetchGuests()
    await fetchAnalytics()
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

      await applyImportResponse(response.data)
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to import file',
        'error'
      )
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleContactPickerImport = async () => {
    if (!contactPickerSupported) return
    setShowImportGuestsModal(false)
    setShowBulkActionsMenu(false)
    setUploading(true)
    try {
      const rows = await selectContactsAsGuestRows()
      if (rows.length === 0) {
        return
      }
      const response = await api.post(`/api/events/${eventId}/guests/import-json/`, {
        guests: rows,
      })
      await applyImportResponse(response.data)
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        showToast('Import cancelled', 'info')
      } else {
        showToast(
          error.response?.data?.error || 'Failed to import contacts',
          'error'
        )
      }
    } finally {
      setUploading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/guests.csv/`, {
        responseType: 'blob',
        validateStatus: (status) => status >= 200 && status < 300,
      })
      const blob = response.data as Blob
      const ct = (response.headers['content-type'] || '').toLowerCase()
      if (ct.includes('application/json') || (blob.size > 0 && blob.type?.includes('json'))) {
        const text = await blob.text()
        try {
          const body = JSON.parse(text) as { detail?: string; error?: string }
          showToast(body.detail || body.error || 'Could not export guest list', 'error')
        } catch {
          showToast('Could not export guest list', 'error')
        }
        return
      }
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeSlug = (event?.slug || String(eventId)).replace(/[^\w.-]/g, '_')
      link.setAttribute('download', `guest_list_${safeSlug}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showToast('Guest list exported successfully', 'success')
    } catch (error: any) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        (typeof error.response?.data === 'string' ? error.response.data : null)
      if (msg) {
        showToast(String(msg), 'error')
        return
      }
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text()
          const body = JSON.parse(text) as { detail?: string; error?: string }
          showToast(body.detail || body.error || 'Failed to export CSV', 'error')
          return
        } catch {
          /* fall through */
        }
      }
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
      const guestParam = selectedGuest.guest_token ? `&g=${selectedGuest.guest_token}` : ''
      const eventUrl = `${getSiteUrl()}/invite/${event.slug || eventId}?source=link${guestParam}`
      
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

              <div className="relative w-full sm:w-auto" ref={bulkActionsMenuRef}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBulkActionsMenu((open) => !open)}
                  className="border-eco-green text-eco-green hover:bg-eco-green-light flex items-center justify-between gap-2 text-sm w-full sm:w-auto whitespace-nowrap sm:min-w-[10.5rem]"
                >
                  <span>Bulk Actions</span>
                  <svg
                    className={`w-4 h-4 shrink-0 transition-transform ${showBulkActionsMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
                {showBulkActionsMenu && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-52 bg-white border-2 border-eco-green-light rounded-md shadow-lg z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setShowImportGuestsModal(true)
                        setShowBulkActionsMenu(false)
                      }}
                      disabled={uploading}
                      className="w-full text-left px-4 py-3 hover:bg-eco-green-light flex items-center gap-3 text-sm border-b border-gray-200 transition-colors disabled:opacity-50"
                    >
                      <span className="text-xl" aria-hidden>
                        ⬆️
                      </span>
                      <span>Import guests</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleExportCSV()
                        setShowBulkActionsMenu(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-eco-green-light flex items-center gap-3 text-sm transition-colors"
                    >
                      <span className="text-xl" aria-hidden>
                        ⬇️
                      </span>
                      <span>Export CSV</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.vcf,.vcard,text/vcard"
                onChange={(e) => {
                  void handleFileUpload(e)
                  setShowImportGuestsModal(false)
                }}
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

        {/* Import guests: modal (phone picker / vCard / spreadsheet) */}
        {showImportGuestsModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-guests-title"
            onClick={() => !uploading && setShowImportGuestsModal(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !uploading) setShowImportGuestsModal(false)
            }}
          >
            <Card
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-xl border-2 border-eco-green-light"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="border-b border-gray-100 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle id="import-guests-title" className="text-eco-green text-lg pr-2">
                    Import guests
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => !uploading && setShowImportGuestsModal(false)}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-2xl font-light w-9 h-9 flex shrink-0 items-center justify-center rounded transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <CardDescription className="text-gray-600 text-sm mt-1">
                  Add many guests at once from your phone or a file. Existing phone numbers are skipped.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">From phone</h3>
                  {contactPickerSupported ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Your browser can open your address book. Choose one or more contacts; names and numbers are sent
                        only to your event guest list.
                      </p>
                      <Button
                        type="button"
                        className="w-full bg-eco-green hover:bg-green-600 text-white"
                        disabled={uploading}
                        onClick={() => void handleContactPickerImport()}
                      >
                        {uploading ? 'Working…' : 'Choose contacts'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        {isLikelyIOS()
                          ? 'On iPhone, save contacts as a contact card, then upload it here.'
                          : 'Export or share contacts from your phone as a contact card (.vcf), then upload it here.'}
                      </p>
                      <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1.5">
                        {isLikelyIOS() ? (
                          <>
                            <li>Open the Contacts app.</li>
                            <li>Select people to invite, then tap Share.</li>
                            <li>Save to Files, AirDrop, or Mail so you can open the .vcf in Safari.</li>
                            <li>Tap the button below and pick that file.</li>
                          </>
                        ) : (
                          <>
                            <li>Open your contacts app and export or share selected contacts as a .vcf file.</li>
                            <li>Save the file where this browser can open it (Downloads, Desktop, etc.).</li>
                            <li>Tap the button below and choose the .vcf file.</li>
                          </>
                        )}
                      </ol>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-eco-green text-eco-green hover:bg-eco-green-light"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? 'Uploading…' : 'Upload contact card (.vcf)'}
                      </Button>
                    </>
                  )}
                </section>

                <div className="border-t border-gray-200 pt-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">From spreadsheet</h3>
                  <p className="text-sm text-gray-600">
                    Use a CSV, TXT, or Excel file with a header row. Required columns:{' '}
                    <span className="font-mono text-gray-800">name</span> and{' '}
                    <span className="font-mono text-gray-800">phone</span>.
                  </p>
                  <details className="text-sm border border-gray-200 rounded-md bg-gray-50/80">
                    <summary className="cursor-pointer select-none px-3 py-2 font-medium text-gray-800">
                      Column details
                    </summary>
                    <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-200">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
                          name
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
                          phone
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                          email
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                          relationship
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                          notes
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Phone is the unique key per event. Duplicate numbers in the file or already on your list are
                        skipped.
                      </p>
                    </div>
                  </details>
                  <Button
                    type="button"
                    className="w-full bg-eco-green hover:bg-green-600 text-white"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Choose CSV or Excel file'}
                  </Button>
                  <p className="text-xs text-gray-500">
                    You can also upload a .vcf from this button if you prefer one file picker for everything.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Guest List Table */}
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <div>
              <CardTitle className="text-eco-green">
                Guests ({guests.filter(g => !g.is_removed).length})
              </CardTitle>
              <CardDescription>
                Everyone you track via the guest list (invited + direct responders)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {/* Toolbar: search, segments, filters + view menus */}
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                <div className="w-full lg:max-w-[16.5rem] lg:shrink-0">
                  <Input
                    type="search"
                    placeholder="Search by guest name..."
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    className="h-9 w-full border-eco-green-light focus:ring-eco-green focus:border-eco-green"
                    aria-label="Search guests by name"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="flex gap-2 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300"
                    role="tablist"
                    aria-label="Guest segments"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setGuestTab('all')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'all'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      All ({guests.filter(g => !g.is_removed).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestTab('invited')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'invited'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      Invited ({guests.filter(g => !g.is_removed && g.source !== 'form_submission').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestTab('direct')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'direct'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      Direct ({guests.filter(g => !g.is_removed && g.source === 'form_submission').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestTab('attending')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'attending'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      Attending ({guests.filter(g => !g.is_removed && (g.rsvp_status === 'yes' || g.rsvp_will_attend === 'yes')).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestTab('declined')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'declined'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      Declined ({guests.filter(g => !g.is_removed && (g.rsvp_status === 'no' || g.rsvp_will_attend === 'no')).length})
                    </button>
                    <button
                      type="button"
                      disabled={!isSlotBasedEvent}
                      onClick={() => {
                        setGuestTab('slot_booked')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'slot_booked'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      } ${!isSlotBasedEvent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isSlotBasedEvent ? 'Show confirmed slot bookings' : 'Only available for slot-based RSVP events'}
                    >
                      Slot booked ({guests.filter(g => !g.is_removed && g.slot_booking_status === 'confirmed').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestTab('no_response')
                        setRsvpFilter('all')
                      }}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        guestTab === 'no_response'
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      No response ({guests.filter(g => !g.is_removed && !g.rsvp_status && !g.rsvp_will_attend).length})
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 lg:shrink-0">
                  <div className="relative" ref={filtersPanelRef}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowFiltersPanel((v) => !v)
                        setShowColumnsMenu(false)
                      }}
                      className="h-9 gap-1.5 border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      aria-expanded={showFiltersPanel}
                      aria-haspopup="dialog"
                    >
                      <Filter className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
                      Filters
                      {refinementFilterCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-eco-green px-1.5 text-[10px] font-semibold leading-none text-white">
                          {refinementFilterCount}
                        </span>
                      ) : null}
                    </Button>
                    {showFiltersPanel && (
                      <div className="absolute right-0 z-50 mt-2 max-h-[min(32rem,75vh)] w-[min(calc(100vw-1.5rem),22rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                        <div className="mb-3 flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Filters</p>
                            <p className="mt-0.5 text-xs text-gray-500">Combine with search and segment chips.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowFiltersPanel(false)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            aria-label="Close filters"
                          >
                            ×
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="mb-1.5 block text-xs font-medium text-gray-700">Category</span>
                            <div className="space-y-2">
                              <select
                                value={categorySource}
                                onChange={(e) => {
                                  setCategorySource(e.target.value as CategorySource)
                                  setCategoryValue('all')
                                }}
                                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900"
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
                                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900"
                              >
                                <option value="all">All values</option>
                                {categoryValueOptions.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              {categoryValue !== 'all' && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setCategoryFilterMode('include')}
                                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                      categoryFilterMode === 'include'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    Include
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCategoryFilterMode('exclude')}
                                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                      categoryFilterMode === 'exclude'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    Exclude
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="mb-1.5 block text-xs font-medium text-gray-700">Invite sent</span>
                            <select
                              value={inviteSentFilter}
                              onChange={(e) => setInviteSentFilter(e.target.value as 'all' | 'sent' | 'not_sent')}
                              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900"
                            >
                              <option value="all">All</option>
                              <option value="sent">Sent</option>
                              <option value="not_sent">Not sent</option>
                            </select>
                            {inviteSentFilter !== 'all' && (
                              <div className="mt-2 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setInviteSentFilterMode('include')}
                                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                    inviteSentFilterMode === 'include'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Include
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInviteSentFilterMode('exclude')}
                                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                    inviteSentFilterMode === 'exclude'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Exclude
                                </button>
                              </div>
                            )}
                          </div>
                          {event?.event_structure === 'ENVELOPE' && subEvents.length > 0 && (
                            <div className="border-t border-gray-100 pt-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-gray-700">Sub-events assigned</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSubEventFilterIds(new Set())}
                                  className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
                                >
                                  Clear
                                </button>
                              </div>
                              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                                {subEvents.map((se) => {
                                  const checked = selectedSubEventFilterIds.has(se.id)
                                  return (
                                    <label key={se.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
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
                                        className="rounded border-gray-300"
                                      />
                                      <span className="truncate" title={se.title}>
                                        {se.title}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                              {selectedSubEventFilterIds.size > 0 && (
                                <div className="mt-2 flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSubEventFilterMode('include')}
                                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                      subEventFilterMode === 'include'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    Include
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSubEventFilterMode('exclude')}
                                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                      subEventFilterMode === 'exclude'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    Exclude
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="border-t border-gray-100 pt-3">
                            {guestTab === 'all' ? (
                              <>
                                <span className="mb-1.5 block text-xs font-medium text-gray-700">RSVP (refine)</span>
                                <select
                                  value={rsvpFilter}
                                  onChange={(e) =>
                                    setRsvpFilter(e.target.value as 'all' | 'unconfirmed' | 'confirmed' | 'no')
                                  }
                                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900"
                                >
                                  <option value="all">All</option>
                                  <option value="unconfirmed">Unconfirmed / no response</option>
                                  <option value="confirmed">Attending / confirmed</option>
                                  <option value="no">Declined</option>
                                </select>
                                {rsvpFilter !== 'all' && (
                                  <div className="mt-2 flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setRsvpFilterMode('include')}
                                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                        rsvpFilterMode === 'include'
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      Include
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRsvpFilterMode('exclude')}
                                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                        rsvpFilterMode === 'exclude'
                                          ? 'bg-red-500 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      Exclude
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500">
                                RSVP refinements apply on the &quot;All&quot; segment only.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
                          <Button type="button" size="sm" onClick={() => setShowFiltersPanel(false)}>
                            Done
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={columnsMenuRef}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowColumnsMenu((v) => !v)
                        setShowFiltersPanel(false)
                      }}
                      className="h-9 gap-1.5 border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      title="Optional middle columns only (name, phone, RSVP, actions stay fixed)"
                      aria-expanded={showColumnsMenu}
                      aria-haspopup="dialog"
                    >
                      <Columns2 className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
                      View
                    </Button>
                    {showColumnsMenu && (
                      <div className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-1.5rem),20rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-lg sm:w-80">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Table view</p>
                            <p className="text-xs text-gray-500">
                              Columns {middleColumnsToRender.length}/{MAX_MIDDLE_COLUMNS} · middle only
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={resetMiddleColumns}
                            className="shrink-0 text-xs text-gray-500 hover:text-gray-800 hover:underline"
                          >
                            Reset columns
                          </button>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                          {middleColumnOptions().map((opt) => {
                            const checked = middleColumnsToRender.includes(opt.key)
                            const atLimit = middleColumnsToRender.length >= MAX_MIDDLE_COLUMNS
                            const disabled = !checked && atLimit
                            return (
                              <label
                                key={opt.key}
                                className={`flex cursor-pointer items-center gap-2 text-sm text-gray-800 ${disabled ? 'opacity-50' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleMiddleColumn(opt.key)}
                                  className="rounded border-gray-300"
                                />
                                <span className="truncate" title={opt.label}>
                                  {opt.label}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        <div className="mt-3 hidden border-t border-gray-100 pt-3 lg:block">
                          <p className="text-xs text-gray-500">Tip: click column headers to sort on larger screens.</p>
                        </div>
                        <div className="mt-3 border-t border-gray-100 pt-3 lg:hidden">
                          <span className="mb-1.5 block text-xs font-medium text-gray-700">Sort</span>
                          <div className="flex gap-2">
                            <select
                              value={sortKey}
                              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                              className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900"
                            >
                              <option value="name">Name</option>
                              <option value="email">Email</option>
                              <option value="category">Category</option>
                              <option value="rsvp_status">RSVP Status</option>
                              <option value="guests_count">Guests Count</option>
                              <option value="invite_sent">Invite sent</option>
                              {event?.event_structure === 'ENVELOPE' && (
                                <option value="sub_events_assigned">Sub-events assigned</option>
                              )}
                              {event?.event_structure === 'ENVELOPE' && event?.rsvp_mode === 'PER_SUBEVENT' && (
                                <option value="sub_events_attending">Sub-events attending</option>
                              )}
                              <option value="notes">Notes</option>
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0 px-3"
                              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                              aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
                            >
                              {sortDir === 'asc' ? '↑' : '↓'}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button type="button" size="sm" onClick={() => setShowColumnsMenu(false)}>
                            Done
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-gray-500">
                    Showing {visibleGuests.length} of {guests.filter(g => !g.is_removed).length}
                  </span>
                  {hasSomethingToReset ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setNameSearch('')
                        setCategorySource('relationship')
                        setCategoryValue('all')
                        setCategoryFilterMode('include')
                        setInviteSentFilter('all')
                        setInviteSentFilterMode('include')
                        setSelectedSubEventFilterIds(new Set())
                        setSubEventFilterMode('include')
                        setRsvpFilter('all')
                        setRsvpFilterMode('include')
                        setSortKey('name')
                        setSortDir('asc')
                      }}
                    >
                      Reset
                    </Button>
                  ) : null}
                </div>
              </div>
              {(nameSearch.trim() ||
                categorySource !== 'relationship' ||
                categoryValue !== 'all' ||
                inviteSentFilter !== 'all' ||
                selectedSubEventFilterIds.size > 0 ||
                (guestTab === 'all' && rsvpFilter !== 'all')) && (
                <div className="flex flex-wrap items-center gap-2">
                  {nameSearch.trim() ? (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800">
                      <span className="truncate">Search: &quot;{nameSearch.trim()}&quot;</span>
                      <button
                        type="button"
                        onClick={() => setNameSearch('')}
                        className="shrink-0 rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                  {categorySource !== 'relationship' || categoryValue !== 'all' ? (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800">
                      <span className="truncate">
                        {categorySourceOptions.find((o) => o.value === categorySource)?.label ?? 'Category'}
                        {categoryValue !== 'all' ? `: ${categoryValue}` : ''}
                        {categoryValue !== 'all' && categoryFilterMode === 'exclude' ? ' · exclude' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCategorySource('relationship')
                          setCategoryValue('all')
                          setCategoryFilterMode('include')
                        }}
                        className="shrink-0 rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                        aria-label="Clear category filter"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                  {inviteSentFilter !== 'all' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800">
                      <span>
                        Invite: {inviteSentFilter === 'sent' ? 'Sent' : 'Not sent'}
                        {inviteSentFilterMode === 'exclude' ? ' · exclude' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteSentFilter('all')
                          setInviteSentFilterMode('include')
                        }}
                        className="shrink-0 rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                        aria-label="Clear invite filter"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                  {selectedSubEventFilterIds.size > 0 ? (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs text-purple-900">
                      <span className="truncate">
                        Sub-events ({selectedSubEventFilterIds.size})
                        {subEventFilterMode === 'exclude' ? ' · exclude' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubEventFilterIds(new Set())
                          setSubEventFilterMode('include')
                        }}
                        className="shrink-0 rounded-full p-0.5 text-purple-600 hover:bg-purple-100 hover:text-purple-950"
                        aria-label="Clear sub-event filter"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                  {guestTab === 'all' && rsvpFilter !== 'all' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800">
                      <span>
                        RSVP:{' '}
                        {rsvpFilter === 'unconfirmed'
                          ? 'Unconfirmed'
                          : rsvpFilter === 'confirmed'
                            ? 'Attending'
                            : 'Declined'}
                        {rsvpFilterMode === 'exclude' ? ' · exclude' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRsvpFilter('all')
                          setRsvpFilterMode('include')
                        }}
                        className="shrink-0 rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                        aria-label="Clear RSVP filter"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Search, segment chips, and filters narrow the same guest list.
              </p>
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
              <>
                {/* Keep bulk bar outside horizontal scroll so the scrollbar sits under the table only */}
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
                <div className="overflow-x-auto pb-2">
                <table className="w-full min-w-[56rem]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-12 align-top text-sm font-medium text-gray-700">
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
                      <th className="text-left p-2 w-44 sm:w-52 align-top box-border overflow-hidden text-sm font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                          title="Sort by name"
                        >
                          Name{sortArrow('name')}
                        </button>
                      </th>
                      <th className="text-left p-2 min-w-[11rem] whitespace-nowrap align-top text-sm font-medium text-gray-700">
                        Phone
                      </th>

                      {middleColumnsToRender.map((col) => {
                        if (col === 'email') {
                          return (
                            <th key={col} className="text-left p-2 align-top text-sm font-medium text-gray-700">
                              <button
                                type="button"
                                onClick={() => toggleSort('email')}
                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                                title="Sort by email"
                              >
                                Email{sortArrow('email')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'relationship') {
                          return (
                            <th key={col} className="text-left p-2 align-top text-sm font-medium text-gray-700">
                              <button
                                type="button"
                                onClick={() => toggleSort('category')}
                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                                title="Sort by relationship"
                              >
                                Relationship{sortArrow('category')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'guests_count') {
                          return (
                            <th key={col} className="text-left p-2 align-top text-sm font-medium text-gray-700">
                              <button
                                type="button"
                                onClick={() => toggleSort('guests_count')}
                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                                title="Sort by guests count"
                              >
                                Guests Count{sortArrow('guests_count')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'notes') {
                          return (
                            <th key={col} className="text-left p-2 align-top text-sm font-medium text-gray-700">
                              <button
                                type="button"
                                onClick={() => toggleSort('notes')}
                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                                title="Sort by notes"
                              >
                                Notes{sortArrow('notes')}
                              </button>
                            </th>
                          )
                        }
                        if (col === 'sub_events_attending') {
                          return (
                            <th key={col} className="text-left p-2 align-top text-sm font-medium text-gray-700">
                              <button
                                type="button"
                                onClick={() => toggleSort('sub_events_attending')}
                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                                title="Sort by sub-events attending"
                              >
                                {getMiddleColumnLabel(col)}
                                {sortArrow('sub_events_attending')}
                              </button>
                            </th>
                          )
                        }

                        return (
                          <th key={col} className="text-left p-2 align-top text-sm font-medium text-gray-700">
                            {getMiddleColumnLabel(col)}
                          </th>
                        )
                      })}

                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => toggleSort('rsvp_status')}
                          className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                          title="Sort by RSVP status"
                        >
                          RSVP Status{sortArrow('rsvp_status')}
                        </button>
                      </th>

                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">
                        <div
                          className="flex flex-col gap-0.5 leading-snug"
                          title="Tracks how many times the guest viewed their invite page and RSVP page"
                        >
                          <span>Page views</span>
                          <span className="text-gray-500 font-normal">Invite · RSVP</span>
                        </div>
                      </th>

                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">
                        <button
                          type="button"
                          onClick={() => toggleSort('invite_sent')}
                          className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                          title="Sort by invite sent"
                        >
                          Invitation Sent{sortArrow('invite_sent')}
                        </button>
                      </th>

                      {event?.event_structure === 'ENVELOPE' && (
                        <th className="text-left p-2 align-top text-sm font-medium text-gray-700">
                          <button
                            type="button"
                            onClick={() => toggleSort('sub_events_assigned')}
                            className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 p-0 h-auto bg-transparent border-0 cursor-pointer rounded-sm text-left shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-eco-green/30"
                            title="Sort by sub-events assigned"
                          >
                            Sub-Events{sortArrow('sub_events_assigned')}
                          </button>
                        </th>
                      )}
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (visibleGuests.length === 0) {
                        return (
                          <tr>
                            <td colSpan={tableColSpan} className="p-8 text-center text-gray-500">
                              {guestTab === 'no_response' && 'No guests without a response'}
                              {guestTab === 'attending' && 'No attending guests'}
                              {guestTab === 'declined' && 'No declined guests'}
                              {guestTab === 'slot_booked' && 'No confirmed slot bookings'}
                              {guestTab === 'invited' && 'No invited guests'}
                              {guestTab === 'direct' && 'No direct guests'}
                              {guestTab === 'all' && 'No guests yet'}
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
                      
                        const getSourceBadge = (source?: Guest['source']): JSX.Element => {
                          const normalized = source || 'manual'
                          const sourceConfig = {
                            manual: { label: 'manual', className: 'bg-gray-100 text-gray-700' },
                            file_import: { label: 'file_import', className: 'bg-blue-100 text-blue-700' },
                            contact_import: { label: 'contact_import', className: 'bg-indigo-100 text-indigo-700' },
                            api_import: { label: 'api_import', className: 'bg-purple-100 text-purple-700' },
                            form_submission: { label: 'form_submission', className: 'bg-green-100 text-green-700' },
                          } as const
                          const config = (sourceConfig as any)[normalized] || sourceConfig.manual
                          return (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
                              {config.label}
                            </span>
                          )
                        }
                        
                      return (
                        <tr key={guest.id} className="border-b hover:bg-gray-50 group">
                          <td className="p-2 w-12 align-top">
                            <input
                              type="checkbox"
                              checked={selectedGuestIds.has(guest.id)}
                              onChange={() => handleToggleGuestSelection(guest.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="p-2 font-medium w-44 sm:w-52 align-top box-border overflow-hidden">
                            <div className="flex flex-col gap-1 items-start min-w-0 w-full sm:flex-row sm:items-center sm:gap-2">
                              <span className="truncate max-w-full" title={guest.name}>
                                {guest.name}
                              </span>
                              <span className="shrink-0 max-w-full">{getSourceBadge(guest.source)}</span>
                            </div>
                          </td>
                          <td className="p-2 text-sm text-gray-600 font-mono min-w-[11rem] whitespace-nowrap align-top">
                            {getDisplayPhone(guest)}
                          </td>

                          {middleColumnsToRender.map((col) => {
                            if (col === 'email') {
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600 max-w-[10rem] sm:max-w-[14rem]">
                                  {guest.email ? (
                                    <span className="block truncate" title={guest.email}>
                                      {guest.email}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
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
                            if (col === 'slot_selected') {
                              const slotTitle =
                                guest.slot_booking_selected_slot_label?.trim() || ''
                              const slotDate = guest.slot_booking_slot_date
                              const hasSlotRow =
                                guest.slot_booking_status === 'confirmed' ||
                                !!slotTitle ||
                                !!slotDate
                              const primary = slotTitle || 'Slot confirmed'
                              const oneLine =
                                hasSlotRow && slotDate
                                  ? `${primary} · ${slotDate}`
                                  : hasSlotRow
                                    ? primary
                                    : ''
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600">
                                  {hasSlotRow ? (
                                    <span
                                      className="inline-flex max-w-[14rem] truncate text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded whitespace-nowrap"
                                      title={oneLine}
                                    >
                                      {oneLine}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              )
                            }
                            if (col === 'notes') {
                              const noteText =
                                (guest.notes && guest.notes.trim()) ||
                                (guest.rsvp_notes && guest.rsvp_notes.trim()) ||
                                ''
                              return (
                                <td key={col} className="p-2 text-sm text-gray-600 max-w-[12rem]">
                                  {noteText ? (
                                    <span className="line-clamp-2 break-words" title={noteText}>
                                      {noteText}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
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
                          <td className="p-2 w-[1%] whitespace-nowrap">
                            <div
                              className="flex items-center gap-1"
                              data-row-actions-root
                              data-guest-id={guest.id}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(guest)}
                                className="text-xs border-blue-300 text-blue-600 hover:bg-blue-50 shrink-0"
                              >
                                Edit
                              </Button>
                              <div className="relative shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  aria-expanded={openRowActionsGuestId === guest.id}
                                  aria-haspopup="menu"
                                  onClick={() =>
                                    setOpenRowActionsGuestId(
                                      openRowActionsGuestId === guest.id ? null : guest.id
                                    )
                                  }
                                  className="text-xs border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                  More
                                </Button>
                                {openRowActionsGuestId === guest.id && (
                                  <div
                                    className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-md border border-gray-200 bg-white shadow-lg py-1"
                                    role="menu"
                                  >
                                    {guest.guest_token && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="w-full text-left px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50"
                                        onClick={() => {
                                          handleCopyGuestLink(guest)
                                          setOpenRowActionsGuestId(null)
                                        }}
                                      >
                                        {copiedGuestId === guest.id ? '✓ Copied' : 'Copy Link'}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50 flex items-center gap-2"
                                      disabled={sharingWhatsApp === guest.id}
                                      onClick={() => {
                                        handleShareWhatsApp(guest)
                                        setOpenRowActionsGuestId(null)
                                      }}
                                    >
                                      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                      </svg>
                                      {sharingWhatsApp === guest.id ? 'Opening...' : 'WhatsApp'}
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                                      onClick={() => {
                                        setOpenRowActionsGuestId(null)
                                        handleDelete(guest.id)
                                      }}
                                    >
                                      {guest.rsvp_status || guest.rsvp_will_attend ? 'Remove' : 'Delete'}
                                    </button>
                                  </div>
                                )}
                              </div>
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
                          <tr key={guest.id} className="border-b bg-gray-50 opacity-60 group">
                            <td className="p-2 w-12 align-top" />
                            <td className="p-2 font-medium text-gray-500 w-44 sm:w-52 align-top box-border overflow-hidden">
                              <span className="truncate block" title={`${guest.name} (Removed)`}>
                                {guest.name}
                              </span>{' '}
                              <span className="text-xs text-gray-400">(Removed)</span>
                            </td>
                            <td className="p-2 text-sm text-gray-500 font-mono min-w-[11rem] whitespace-nowrap align-top">
                              {getDisplayPhone(guest)}
                            </td>

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
              </>
            )}
            </div>
          </CardContent>
        </Card>

        {/* Other Guests Table - RSVPs from people not in guest list */}
        {(otherGuests.length > 0 || removedGuests.length > 0) && (
          <Card className="bg-white border-2 border-eco-green-light mt-8">
            <CardHeader>
              <CardTitle className="text-eco-green">
                {otherGuests.filter(g => !g.is_removed).length > 0
                  ? `Other Guests (${otherGuests.filter(g => !g.is_removed).length})`
                  : `Removed Guests (${removedGuests.length})`}
                {otherGuests.filter(g => !g.is_removed).length > 0 && removedGuests.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({removedGuests.length} removed)
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {otherGuests.filter(g => !g.is_removed).length > 0
                  ? "People who RSVP'd but weren't in your original guest list"
                  : 'Guests you removed from the guest list'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto pb-2">
                <table className="w-full min-w-[48rem]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700 w-40 sm:w-48 box-border overflow-hidden">
                        Name
                      </th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Country Code</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Phone Number</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Email</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">RSVP Status</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Guests Count</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Source</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Notes</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">RSVP Date</th>
                      <th className="text-left p-2 align-top text-sm font-medium text-gray-700">Actions</th>
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
                        <tr key={guest.id} className="border-b hover:bg-gray-50 group">
                          <td className="p-2 font-medium w-40 sm:w-48 box-border overflow-hidden">
                            <span className="truncate block" title={guest.name}>
                              {guest.name}
                            </span>
                          </td>
                          <td className="p-2 text-sm text-gray-700 font-mono">
                            {guest.country_code || '-'}
                          </td>
                          <td className="p-2 text-sm text-gray-600 font-mono">
                            {guest.local_number || guest.phone || '-'}
                          </td>
                          <td className="p-2 text-sm text-gray-600 max-w-[10rem] sm:max-w-[14rem]">
                            {guest.email ? (
                              <span className="block truncate" title={guest.email}>
                                {guest.email}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
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
                          <td className="p-2 w-[1%] whitespace-nowrap">
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
                      <tr key={guest.id} className="border-b bg-gray-50 opacity-60 group">
                        <td className="p-2 font-medium text-gray-500 w-40 sm:w-48 box-border overflow-hidden">
                          <span className="truncate block" title={guest.name}>
                            {guest.name}
                          </span>{' '}
                          <span className="text-xs text-gray-400">(Removed)</span>
                        </td>
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

