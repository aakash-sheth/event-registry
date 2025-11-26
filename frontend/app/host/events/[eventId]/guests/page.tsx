'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getCountryCode, formatPhoneWithCountryCode } from '@/lib/countryCodesFull'
import CountryCodeSelector from '@/components/CountryCodeSelector'
import { generateWhatsAppLink, generateGuestMessage, openWhatsApp } from '@/lib/whatsapp'

const guestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone number is required (minimum 10 digits)'),
  country_code: z.string().optional(),
  country_iso: z.string().optional(),  // ISO country code for analytics
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relationship: z.string().optional(),
  notes: z.string().optional(),
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
}

interface Event {
  id: number
  slug: string
  title: string
  date: string | null
  country: string
  country_code: string
  whatsapp_message_template?: string
}

export default function GuestsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [guests, setGuests] = useState<Guest[]>([])
  const [otherGuests, setOtherGuests] = useState<OtherGuest[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importErrors, setImportErrors] = useState<string[] | null>(null)
  const [importSummary, setImportSummary] = useState<{created: number, errors: number} | null>(null)
  const [sharingWhatsApp, setSharingWhatsApp] = useState<number | null>(null)
  const [rsvpFilter, setRsvpFilter] = useState<'all' | 'unconfirmed' | 'confirmed' | 'no'>('all')
  const [showImportExportMenu, setShowImportExportMenu] = useState(false)
  const [showImportInstructions, setShowImportInstructions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
    fetchEvent()
    fetchGuests()
  }, [eventId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowImportExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  
  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
      console.error('Failed to fetch event:', error)
      }
    }
  }

  const fetchGuests = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/guests/`)
      // Handle both old format (array) and new format (object with guests and other_guests)
      if (Array.isArray(response.data)) {
      setGuests(response.data)
        setOtherGuests([])
      } else {
        setGuests(response.data.guests || [])
        setOtherGuests(response.data.other_guests || [])
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

  const onSubmit = async (data: GuestForm) => {
    try {
      // Format phone with country code
      const countryCode = data.country_code || event?.country_code || '+91'
      const formattedPhone = formatPhoneWithCountryCode(data.phone, countryCode)
      
      if (editingGuest) {
        // Update existing guest
        await api.put(`/api/events/${eventId}/guests/${editingGuest.id}/`, {
          ...data,
          phone: formattedPhone,
          country_code: countryCode,
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
      fetchGuests()
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
      fetchGuests()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to import CSV',
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
    if (!confirm('Are you sure you want to remove this guest from the list?')) {
      return
    }

    try {
      await api.delete(`/api/events/${eventId}/guests/${guestId}/`)
      showToast('Guest removed', 'success')
      fetchGuests()
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to remove guest',
        'error'
      )
    }
  }

  const handleShareWhatsApp = async (guest: Guest) => {
    if (!event) return
    
    setSharingWhatsApp(guest.id)
    try {
      const eventUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/event/${event.slug || eventId}` 
        : ''
      
      const message = generateGuestMessage(
        guest.name,
        event.title || 'Event',
        event.date,
        eventUrl,
        undefined, // Host name
        event.city || '', // Event location
        (event as any).whatsapp_message_template // Custom template
      )
      
      const whatsappUrl = generateWhatsAppLink(guest.phone, message)
      openWhatsApp(whatsappUrl)
      showToast(`Opening WhatsApp to ${guest.name}...`, 'success')
    } catch (error: any) {
      console.error('Failed to share on WhatsApp:', error)
      showToast('Failed to open WhatsApp', 'error')
    } finally {
      setSharingWhatsApp(null)
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href={`/host/events/${eventId}`}>
            <Button variant="outline" className="mb-4 border-eco-green text-eco-green hover:bg-eco-green-light">
              ← Back to Event
            </Button>
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-eco-green">Guest List</h1>
              <p className="text-gray-700">
                Manage your invited guests. Track who RSVP'd and gave gifts.
              </p>
            </div>
            <div className="flex gap-2 relative">
              {/* Add Guest Button */}
              <Button
                onClick={() => {
                  if (showForm) {
                    handleCancel()
                  } else {
                    setShowForm(true)
                  }
                }}
                className="bg-eco-green hover:bg-green-600 text-white"
              >
                {showForm ? 'Cancel' : '+ Add Guest'}
              </Button>
              
              {/* Import/Export Dropdown */}
              <div className="relative" ref={menuRef}>
                <Button
                  variant="outline"
                  onClick={() => setShowImportExportMenu(!showImportExportMenu)}
                  className="border-eco-green text-eco-green hover:bg-eco-green-light flex items-center gap-2"
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
                  <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-eco-green-light rounded-md shadow-lg z-50">
                    <button
                      onClick={() => {
                        setShowImportInstructions(true)
                        setShowImportExportMenu(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-eco-green-light flex items-center gap-3 text-sm border-b border-gray-200 transition-colors"
                    >
                      <span className="text-xl">⬆️</span>
                      <span>Import CSV</span>
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
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </div>
        </div>

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
                      {...register('country_code')}
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
                <CardTitle className="text-gray-800 text-xl">Import Guests from CSV</CardTitle>
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
                  <h3 className="text-base font-semibold text-gray-800 mb-3">CSV Format Requirements</h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Your CSV file should include the following columns:
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
                  accept=".csv"
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
                      Choose CSV File to Upload
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
            
            {/* RSVP Status Filters */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setRsvpFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  rsvpFilter === 'all'
                    ? 'bg-eco-green text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({guests.length})
              </button>
              <button
                onClick={() => setRsvpFilter('unconfirmed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  rsvpFilter === 'unconfirmed'
                    ? 'bg-eco-green text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Unconfirmed ({guests.filter(g => !g.rsvp_status && !g.rsvp_will_attend).length})
              </button>
              <button
                onClick={() => setRsvpFilter('confirmed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  rsvpFilter === 'confirmed'
                    ? 'bg-eco-green text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Confirmed ({guests.filter(g => g.rsvp_status === 'yes' || g.rsvp_will_attend === 'yes').length})
              </button>
              <button
                onClick={() => setRsvpFilter('no')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  rsvpFilter === 'no'
                    ? 'bg-eco-green text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Declined ({guests.filter(g => g.rsvp_status === 'no' || g.rsvp_will_attend === 'no').length})
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {guests.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-gray-600 mb-4">No guests added yet</p>
                <p className="text-sm text-gray-500 mb-6">
                  Add guests manually or import from CSV to track RSVPs and gifts
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
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Country Code</th>
                      <th className="text-left p-2">Phone Number</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Relationship</th>
                      <th className="text-left p-2">RSVP Status</th>
                      <th className="text-left p-2">Notes</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Filter guests based on RSVP status
                      let filteredGuests = guests
                      
                      if (rsvpFilter === 'unconfirmed') {
                        filteredGuests = guests.filter(g => !g.rsvp_status && !g.rsvp_will_attend)
                      } else if (rsvpFilter === 'confirmed') {
                        filteredGuests = guests.filter(g => g.rsvp_status === 'yes' || g.rsvp_will_attend === 'yes')
                      } else if (rsvpFilter === 'no') {
                        filteredGuests = guests.filter(g => g.rsvp_status === 'no' || g.rsvp_will_attend === 'no')
                      }
                      
                      if (filteredGuests.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-gray-500">
                              {rsvpFilter === 'unconfirmed' && 'No unconfirmed guests'}
                              {rsvpFilter === 'confirmed' && 'No confirmed guests'}
                              {rsvpFilter === 'no' && 'No declined guests'}
                              {rsvpFilter === 'all' && 'No guests yet'}
                            </td>
                          </tr>
                        )
                      }
                      
                      return filteredGuests.map((guest) => {
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
                          <td className="p-2 font-medium">{guest.name}</td>
                          <td className="p-2 text-sm text-gray-700 font-mono">
                            {guest.country_code || '-'}
                          </td>
                          <td className="p-2 text-sm text-gray-600 font-mono">
                            {guest.local_number || guest.phone || '-'}
                          </td>
                          <td className="p-2 text-sm text-gray-600">{guest.email || '-'}</td>
                          <td className="p-2 text-sm text-gray-600">{guest.relationship || '-'}</td>
                          <td className="p-2">
                            {getRsvpStatusBadge(guest.rsvp_status || guest.rsvp_will_attend)}
                          </td>
                          <td className="p-2 text-sm text-gray-600">{guest.notes || '-'}</td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => handleShareWhatsApp(guest)}
                                disabled={sharingWhatsApp === guest.id}
                                className="border-green-300 text-green-600 hover:bg-green-50 text-xs flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                {sharingWhatsApp === guest.id ? 'Opening...' : 'WhatsApp'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleEdit(guest)}
                                className="border-blue-300 text-blue-600 hover:bg-blue-50 text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleDelete(guest.id)}
                                className="border-red-300 text-red-600 hover:bg-red-50 text-xs"
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other Guests Table - RSVPs from people not in guest list */}
        {otherGuests.length > 0 && (
          <Card className="bg-white border-2 border-eco-green-light mt-8">
            <CardHeader>
              <CardTitle className="text-eco-green">
                Other Guests ({otherGuests.length})
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
                    </tr>
                  </thead>
                  <tbody>
                    {otherGuests.map((guest) => {
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
                        </tr>
                      )
                    })}
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
      </div>
    </div>
  )
}

