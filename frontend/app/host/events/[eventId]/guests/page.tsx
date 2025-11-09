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

interface Event {
  id: number
  country: string
  country_code: string
}

export default function GuestsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [guests, setGuests] = useState<Guest[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importErrors, setImportErrors] = useState<string[] | null>(null)
  const [importSummary, setImportSummary] = useState<{created: number, errors: number} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  
  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
    } catch (error: any) {
      console.error('Failed to fetch event:', error)
    }
  }

  const fetchGuests = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/guests/`)
      setGuests(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
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
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <Button
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="border-eco-green text-eco-green hover:bg-eco-green-light"
              >
                {uploading ? 'Uploading...' : '📥 Import CSV'}
              </Button>
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

        {/* CSV Import Instructions */}
        <Card className="mb-8 bg-eco-green-light border-2 border-eco-green">
          <CardContent className="py-4">
            <p className="text-sm text-gray-700 mb-2">
              <strong>CSV Format:</strong> Your CSV should have columns: <code>name</code>, <code>phone</code>, <code>email</code>, <code>relationship</code>, <code>notes</code>.
            </p>
            <p className="text-sm text-gray-700">
              <strong>Required:</strong> <code>name</code> and <code>phone</code> (phone is used as unique identifier per event).
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <strong>Note:</strong> If a guest with the same phone number already exists, the row will be skipped. You can merge duplicate entries manually if needed.
            </p>
          </CardContent>
        </Card>

        {/* Guest List Table */}
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">
              Invited Guests ({guests.length})
            </CardTitle>
            <CardDescription>
              Guests from this list who RSVP or give gifts will be marked as "Core Guests"
            </CardDescription>
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
                    {guests.map((guest) => {
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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

