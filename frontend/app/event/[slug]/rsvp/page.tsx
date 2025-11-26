'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { formatPhoneWithCountryCode } from '@/lib/countryCodesFull'
import CountryCodeSelector from '@/components/CountryCodeSelector'

const rsvpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  country_code: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  will_attend: z.enum(['yes', 'no', 'maybe']),
  guests_count: z.number().min(0).default(0),
  notes: z.string().optional(),
})

type RSVPForm = z.infer<typeof rsvpSchema>

interface Event {
  id: number
  title: string
  date: string
  city: string
  country: string
  country_code: string
  banner_image?: string
  description?: string
  additional_photos?: string[]
  has_rsvp?: boolean
  slug?: string
}

interface ExistingRSVP {
  id: number
  name: string
  phone: string
  email: string
  will_attend?: 'yes' | 'no' | 'maybe'
  guests_count?: number
  notes?: string
  created_at?: string
  updated_at?: string
  found_in?: 'rsvp' | 'guest_list'
  has_rsvp?: boolean
}

export default function RSVPPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const { showToast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [existingRSVP, setExistingRSVP] = useState<ExistingRSVP | null>(null)
  const [checkingRSVP, setCheckingRSVP] = useState(false)
  
  // Detect QR code source from URL parameter
  const sourceChannel = searchParams.get('source') === 'qr' ? 'qr' : 'link'

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RSVPForm>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      will_attend: 'yes',
      guests_count: 0,
      country_code: '+91', // Will be updated when event loads
    },
  })

  const willAttend = watch('will_attend')
  const phoneValue = watch('phone')
  const countryCodeValue = watch('country_code')

  useEffect(() => {
    fetchEvent()
  }, [slug])

  // Check for existing RSVP when phone number is entered
  useEffect(() => {
    if (!event || !phoneValue || phoneValue.length < 10) {
      setExistingRSVP(null)
      return
    }

    // Debounce the check
    const timeoutId = setTimeout(async () => {
      try {
        setCheckingRSVP(true)
        const countryCode = countryCodeValue || event?.country_code || '+91'
        
        console.log('=== RSVP Check Debug ===')
        console.log('Phone entered:', phoneValue)
        console.log('Country code selected:', countryCodeValue)
        console.log('Country code used:', countryCode)
        console.log('Event ID:', event.id)
        console.log('Full request params:', {
          phone: phoneValue,
          country_code: countryCode,
        })
        
        const response = await api.get(`/api/events/${event.id}/rsvp/check/`, {
          params: {
            phone: phoneValue,
            country_code: countryCode,
          },
        })
        
        const foundIn = response.data.found_in || 'rsvp'
        console.log(`=== ${foundIn === 'rsvp' ? 'RSVP' : 'Guest'} Found ===`)
        console.log('Response data:', response.data)
        console.log('Stored phone in DB:', response.data.phone)
        setExistingRSVP(response.data)
        
        // Extract local phone number and country code from stored phone
        // Stored phone format: +91XXXXXXXXXX
        let localPhone = ''
        let storedCountryCode = countryCode
        
        if (response.data.phone) {
          const storedPhone = response.data.phone.trim()
          
          if (storedPhone.startsWith('+')) {
            // Extract country code and local number
            const phoneDigits = storedPhone.replace(/\D/g, '')
            
            // Try to match with current country code first
            const currentCodeDigits = countryCode.replace('+', '')
            if (phoneDigits.startsWith(currentCodeDigits)) {
              storedCountryCode = countryCode
              localPhone = phoneDigits.slice(currentCodeDigits.length)
            } else {
              // Try common country codes
              const commonCodes = [
                { code: '91', full: '+91' },   // India
                { code: '1', full: '+1' },     // US/Canada
                { code: '44', full: '+44' },   // UK
                { code: '86', full: '+86' },   // China
                { code: '81', full: '+81' },   // Japan
                { code: '49', full: '+49' },   // Germany
                { code: '33', full: '+33' },   // France
                { code: '39', full: '+39' },   // Italy
                { code: '7', full: '+7' },      // Russia
                { code: '61', full: '+61' },    // Australia
              ]
              
              for (const { code, full } of commonCodes) {
                if (phoneDigits.startsWith(code)) {
                  storedCountryCode = full
                  localPhone = phoneDigits.slice(code.length)
                  break
                }
              }
              
              // If no match found, assume it's the current country code
              if (!localPhone) {
                storedCountryCode = countryCode
                localPhone = phoneDigits.slice(currentCodeDigits.length) || phoneDigits
              }
            }
          } else {
            // Phone doesn't start with +, might be just local number
            localPhone = storedPhone.replace(/\D/g, '')
          }
        }
        
        // Pre-fill form with data
        // Use shouldValidate: false to avoid validation errors during auto-fill
        setValue('name', response.data.name, { shouldValidate: false, shouldDirty: true })
        setValue('phone', localPhone, { shouldValidate: false, shouldDirty: true })
        setValue('country_code', storedCountryCode, { shouldValidate: false, shouldDirty: true })
        setValue('email', response.data.email || '', { shouldValidate: false, shouldDirty: true })
        
        // Only pre-fill RSVP-specific fields if it's an existing RSVP
        if (foundIn === 'rsvp' && response.data.will_attend) {
          setValue('will_attend', response.data.will_attend, { shouldValidate: false, shouldDirty: true })
          setValue('guests_count', response.data.guests_count || 1, { shouldValidate: false, shouldDirty: true })
          setValue('notes', response.data.notes || '', { shouldValidate: false, shouldDirty: true })
        } else {
          // Guest list - set defaults for RSVP fields
          setValue('will_attend', 'yes', { shouldValidate: false, shouldDirty: false })
          setValue('guests_count', 1, { shouldValidate: false, shouldDirty: false })
          setValue('notes', '', { shouldValidate: false, shouldDirty: false })
        }
        
        console.log('Form values set:', {
          name: response.data.name,
          phone: localPhone,
          country_code: storedCountryCode,
          email: response.data.email,
          found_in: foundIn,
          will_attend: foundIn === 'rsvp' ? response.data.will_attend : 'yes (default)',
        })
      } catch (error: any) {
        // No existing RSVP found - that's okay
        if (error.response?.status === 404) {
          console.log('No existing RSVP found for this phone number')
          // Log debug info if available
          if (error.response?.data?.debug) {
            console.log('Debug info:', error.response.data.debug)
            console.log('Searched phone:', error.response.data.debug.searched_phone)
            console.log('All phones in DB:', error.response.data.debug.all_phones_in_db)
          }
        } else {
          console.error('Error checking RSVP:', error)
          showToast('Error checking for existing RSVP', 'error')
        }
        setExistingRSVP(null)
      } finally {
        setCheckingRSVP(false)
      }
    }, 1000) // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId)
  }, [phoneValue, countryCodeValue, event, setValue])

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/registry/${slug}/items/`)
      const eventData = response.data.event
      console.log('Event data received:', eventData)
      console.log('Banner image:', eventData?.banner_image)
      console.log('Description:', eventData?.description)
      console.log('Additional photos:', eventData?.additional_photos)
      
      // Check if RSVP is enabled
      if (!eventData.has_rsvp) {
        showToast('RSVP is not available for this event', 'info')
        // Redirect to invitation page
        router.push(`/registry/${slug}`)
        return
      }
      
      setEvent({ ...eventData, slug })
      // Set default country code from event
      if (eventData?.country_code) {
        setValue('country_code', eventData.country_code)
      }
    } catch (error: any) {
      console.error('Failed to fetch event:', error)
      // If 403 error, RSVP is disabled
      if (error.response?.status === 403) {
        showToast('RSVP is not available for this event', 'info')
        router.push(`/registry/${slug}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: RSVPForm) => {
    setSubmitting(true)
    try {
      // Format phone with country code
      const countryCode = data.country_code || event?.country_code || '+91'
      const formattedPhone = formatPhoneWithCountryCode(data.phone, countryCode)
      
      const response = await api.post(`/api/events/${event?.id}/rsvp/`, {
        name: data.name,
        phone: formattedPhone,
        country_code: countryCode,
        email: data.email || '',
        will_attend: data.will_attend,
        guests_count: data.guests_count,
        notes: data.notes || '',
        source_channel: sourceChannel,
      })
      
      const isUpdate = existingRSVP !== null && existingRSVP.found_in === 'rsvp'
      const isFirstRSVP = existingRSVP !== null && existingRSVP.found_in === 'guest_list'
      
      let message = ''
      if (isUpdate) {
        message = 'RSVP updated successfully! 🌿 Thanks for keeping us informed.'
      } else if (isFirstRSVP) {
        message = 'RSVP confirmed! 🌿 Thanks for helping us plan better.'
      } else {
        message = 'RSVP confirmed! 🌿 Thanks for helping us plan better.'
      }
      
      showToast(message, 'success')
      
      // Update existing RSVP state (now it will be an RSVP, not guest list)
      setExistingRSVP({ ...response.data, found_in: 'rsvp' })
      
      // Redirect to registry after a moment (longer for updates so user can see the change)
      setTimeout(() => {
        window.location.href = `/registry/${slug}`
      }, isUpdate ? 3000 : 2000)
    } catch (error: any) {
      console.error('RSVP error:', error)
      const errorMsg = error.response?.data?.error || 
                      (error.response?.data ? JSON.stringify(error.response.data) : 'Failed to submit RSVP')
      showToast(errorMsg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-eco-beige flex items-center justify-center">Loading...</div>
  }

  if (!event) {
    return <div className="min-h-screen bg-eco-beige flex items-center justify-center">Event not found</div>
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Banner Image */}
        {event.banner_image && event.banner_image.trim() && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={event.banner_image}
              alt={event.title}
              className="w-full h-64 md:h-80 object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-eco-green">{event.title}</h1>
          {event.date && (
            <p className="text-lg text-gray-700">
              {new Date(event.date).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
          {event.city && <p className="text-gray-600">{event.city}</p>}
        </div>

        {/* Description */}
        {event.description && event.description.trim() && (
          <Card className="bg-white border-eco-green-light mb-6">
            <CardContent className="pt-6">
              <div
                className="text-gray-700 prose prose-sm max-w-none text-center"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </CardContent>
          </Card>
        )}

        {/* Additional Photos */}
        {event.additional_photos && Array.isArray(event.additional_photos) && event.additional_photos.length > 0 && (
          <Card className="bg-white border-eco-green-light mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-2">
                {event.additional_photos.filter(photo => photo && photo.trim()).map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Event photo ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* RSVP Form */}
        <Card className="bg-white border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green text-2xl">
              {existingRSVP 
                ? (existingRSVP.found_in === 'guest_list' 
                    ? 'You\'re Invited! 🌿' 
                    : 'Update your RSVP 🌿')
                : 'Confirm your attendance 🌿'}
            </CardTitle>
            <CardDescription>
              {existingRSVP 
                ? (existingRSVP.found_in === 'guest_list'
                    ? 'You\'re on the guest list! Please confirm your attendance below.'
                    : 'You already RSVP\'d. Update your response below if anything has changed.')
                : 'Help us plan better and reduce waste with accurate RSVPs'
              }
            </CardDescription>
            {existingRSVP && existingRSVP.found_in === 'rsvp' && existingRSVP.will_attend && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Your current RSVP:</strong> {existingRSVP.will_attend === 'yes' ? 'Yes' : existingRSVP.will_attend === 'no' ? 'No' : 'Maybe'}
                  {existingRSVP.will_attend === 'yes' && existingRSVP.guests_count && existingRSVP.guests_count > 0 && (
                    <span> ({existingRSVP.guests_count} {existingRSVP.guests_count === 1 ? 'guest' : 'guests'})</span>
                  )}
                </p>
                {existingRSVP.updated_at && (
                  <p className="text-xs text-blue-600 mt-1">
                    Last updated: {new Date(existingRSVP.updated_at).toLocaleString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}
            {existingRSVP && existingRSVP.found_in === 'guest_list' && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Welcome!</strong> We found you in our guest list. Please fill out the form below to confirm your attendance.
                </p>
              </div>
            )}
            {checkingRSVP && (
              <p className="text-sm text-gray-500 mt-2">Checking for existing RSVP or guest list...</p>
            )}
          </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <Input {...register('name')} placeholder="Your name" />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone Number *</label>
                <div className="flex gap-2">
                  <CountryCodeSelector
                    {...register('country_code')}
                    defaultValue={event?.country_code || '+91'}
                    onChange={(value) => {
                      setValue('country_code', value, { shouldValidate: true })
                    }}
                    className="w-48"
                  />
                  <Input
                    type="tel"
                    {...register('phone')}
                    placeholder="10-digit phone number"
                    className="flex-1"
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  We'll send updates via SMS or WhatsApp
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email (optional)</label>
                <Input type="email" {...register('email')} placeholder="your@email.com" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Will you attend? *</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="yes"
                      {...register('will_attend')}
                      className="mr-2"
                    />
                    <span className="text-eco-green font-medium">Yes</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="maybe"
                      {...register('will_attend')}
                      className="mr-2"
                    />
                    <span>Maybe</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="no"
                      {...register('will_attend')}
                      className="mr-2"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {willAttend === 'yes' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Number of guests (including you)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    {...register('guests_count', { valueAsNumber: true })}
                    placeholder="1"
                  />
                  {errors.guests_count && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.guests_count.message}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Notes (optional)
                </label>
                <textarea
                  {...register('notes')}
                  className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Dietary preferences, special requests, etc."
                />
              </div>

              <div className="bg-eco-green-light p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  🌱 <strong>Every accurate RSVP helps reduce food waste!</strong> Your response helps us plan better and celebrate sustainably.
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || checkingRSVP}
                className="w-full bg-eco-green hover:bg-green-600 text-white py-6 text-lg"
              >
                {submitting 
                  ? (existingRSVP?.found_in === 'rsvp' ? 'Updating...' : 'Submitting...') 
                  : (existingRSVP?.found_in === 'rsvp' ? 'Update RSVP 🌿' : 'Confirm RSVP 🌿')
                }
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Link to Registry */}
        <div className="text-center mt-8">
          <Link href={`/registry/${slug}`}>
            <Button variant="outline" className="border-eco-green text-eco-green">
              View Gift Registry →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

