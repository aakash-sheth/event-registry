'use client'

import { useEffect, useState, useRef } from 'react'
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
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import { getEventDetailsFromConfig } from '@/lib/event/utils'
import { BRAND_NAME, COMPANY_HOMEPAGE } from '@/lib/brand_utility'

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
  has_registry?: boolean
  is_public?: boolean
  slug?: string
  page_config?: {
    tiles?: Array<{
      type: string
      enabled?: boolean
      settings?: any
    }>
  }
}

interface ExistingRSVP {
  id?: number  // Optional - only present for existing RSVPs, not for guest list entries
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
  const [showThankYou, setShowThankYou] = useState(false)
  
  // Stage 0 phone verification for private events
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneNotInList, setPhoneNotInList] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState<string>('')
  const [verifiedCountryCode, setVerifiedCountryCode] = useState<string>('')
  
  // Refs to track phone check cancellation
  const phoneCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isPhoneCheckCancelledRef = useRef(false)
  
  // Detect QR code source from URL parameter
  const sourceChannel = searchParams.get('source') === 'qr' ? 'qr' : 'link'

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    reset,
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
      // Clear any pending check
      if (phoneCheckTimeoutRef.current) {
        clearTimeout(phoneCheckTimeoutRef.current)
        phoneCheckTimeoutRef.current = null
      }
      isPhoneCheckCancelledRef.current = false
      return
    }

    // Cancel previous check if it exists
    if (phoneCheckTimeoutRef.current) {
      clearTimeout(phoneCheckTimeoutRef.current)
      phoneCheckTimeoutRef.current = null
    }
    isPhoneCheckCancelledRef.current = false

    // Debounce the check
    phoneCheckTimeoutRef.current = setTimeout(async () => {
      try {
        setCheckingRSVP(true)
        isPhoneCheckCancelledRef.current = false
        const countryCode = countryCodeValue || event?.country_code || '+91'
        
        logDebug('Checking RSVP for phone:', { phone: phoneValue, country_code: countryCode })
        
        const response = await api.get(`/api/events/${event.id}/rsvp/check/`, {
          params: {
            phone: phoneValue,
            country_code: countryCode,
          },
        })
        
        // Check if this check was cancelled (user changed phone number)
        if (isPhoneCheckCancelledRef.current) {
          logDebug('Phone check was cancelled, ignoring result')
          return
        }
        
        const foundIn = response.data.found_in || 'rsvp'
        logDebug('RSVP check result:', { found_in: foundIn, phone: response.data.phone })
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
        
        // Pre-fill form with data ONLY if fields are empty
        // This prevents overwriting user input when they're actively filling the form
        // Use getValues() instead of watch() to get current values synchronously
        // This avoids race conditions with network latency (watch() can return stale values)
        const currentName = getValues('name')
        const currentEmail = getValues('email')
        const currentPhone = getValues('phone')
        
        // Only pre-fill if the field is empty or just whitespace
        if (!currentName || currentName.trim() === '') {
          setValue('name', response.data.name, { shouldValidate: false, shouldDirty: true })
        }
        // Only update phone if we found a valid localPhone AND it's different from what user typed
        // This prevents clearing the phone field when check returns 404 or invalid data
        if (localPhone && localPhone.trim() !== '' && localPhone !== currentPhone) {
          setValue('phone', localPhone, { shouldValidate: false, shouldDirty: true })
        }
        // Only update country code if it's different from current
        const currentCountryCode = getValues('country_code')
        if (storedCountryCode !== currentCountryCode) {
          setValue('country_code', storedCountryCode, { shouldValidate: false, shouldDirty: true })
        }
        // Only pre-fill email if empty
        if (!currentEmail || currentEmail.trim() === '') {
          setValue('email', response.data.email || '', { shouldValidate: false, shouldDirty: true })
        }
        
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
        
        logDebug('Form values pre-filled from existing RSVP')
      } catch (error: any) {
        // Check if this check was cancelled before updating state
        if (isPhoneCheckCancelledRef.current) {
          logDebug('Phone check was cancelled, ignoring error')
          return
        }
        
        // Check for 403 error (removed guest/RSVP)
        if (error.response?.status === 403) {
          const errorMessage = error.response?.data?.error || 'Access denied'
          logDebug('Access denied for RSVP:', errorMessage)
          showToast(errorMessage, 'error')
          setExistingRSVP(null)
          // Don't allow form submission
          return
        }
        
        // No existing RSVP found - that's okay
        if (error.response?.status === 404) {
          logDebug('No existing RSVP found for this phone number')
          // Don't modify form at all on 404 - user's input should remain intact
        } else {
          logError('Error checking RSVP:', error)
          showToast('Error checking for existing RSVP', 'error')
        }
        setExistingRSVP(null)
      } finally {
        // Only update checking state if check wasn't cancelled
        if (!isPhoneCheckCancelledRef.current) {
          setCheckingRSVP(false)
        }
      }
    }, 1000) // Wait 1 second after user stops typing

    return () => {
      if (phoneCheckTimeoutRef.current) {
        clearTimeout(phoneCheckTimeoutRef.current)
        phoneCheckTimeoutRef.current = null
      }
      isPhoneCheckCancelledRef.current = true // Mark as cancelled when effect cleans up
    }
  }, [phoneValue, countryCodeValue, event, setValue, getValues, showToast])

  const fetchEvent = async () => {
    try {
      // Use the public event endpoint (doesn't require registry to be enabled)
      const response = await api.get(`/api/registry/${slug}/`)
      const eventData = response.data
      
      // Check if RSVP is enabled
      if (!eventData.has_rsvp) {
        showToast('RSVP is not available for this event', 'info')
        // Redirect to invitation page
        router.push(`/invite/${slug}`)
        return
      }
      
      setEvent({ ...eventData, slug })
      // Set default country code from event
      if (eventData?.country_code) {
        setValue('country_code', eventData.country_code)
      }
      
      // Reset Stage 0 state when event changes
      setPhoneVerified(false)
      setPhoneNotInList(false)
      setVerifiedPhoneNumber('')
      setVerifiedCountryCode('')
    } catch (error: any) {
      logError('Failed to fetch event:', error)
      // If 403 error, RSVP is disabled or event is private
      if (error.response?.status === 403) {
        showToast('RSVP is not available for this event', 'info')
        router.push(`/invite/${slug}`)
      } else if (error.response?.status === 404) {
        showToast('Event not found', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneVerification = async () => {
    if (!event) return
    
    const phone = getValues('phone')
    const countryCode = getValues('country_code') || event.country_code || '+91'
    
    if (!phone || phone.length < 10) {
      showToast('Please enter a valid phone number', 'error')
      return
    }
    
    setVerifyingPhone(true)
    setPhoneNotInList(false)
    
    try {
      const response = await api.post(`/api/events/${event.id}/rsvp/check/phone/`, {
        phone,
        country_code: countryCode,
      })
      
      // Phone verified - check if it's an existing RSVP (grandfather clause) or guest list
      const data = response.data
      setPhoneVerified(true)
      setVerifiedPhoneNumber(phone)
      setVerifiedCountryCode(countryCode)
      
      // If existing RSVP found (grandfather clause), set existingRSVP state
      if (data.found_in === 'rsvp') {
        setExistingRSVP({
          id: data.id,
          name: data.name,
          phone: data.phone,
          email: data.email || '',
          will_attend: data.will_attend,
          guests_count: data.guests_count || 1,
          notes: data.notes || '',
          found_in: 'rsvp',
          has_rsvp: true,
        })
      } else {
        // Guest list entry found
        setExistingRSVP({
          name: data.name,
          phone: data.phone,
          email: data.email || '',
          found_in: 'guest_list',
          has_rsvp: false,
        })
      }
      
      // Pre-fill form fields
      if (data.name) {
        setValue('name', data.name, { shouldValidate: false, shouldDirty: true })
      }
      if (data.email) {
        setValue('email', data.email, { shouldValidate: false, shouldDirty: true })
      }
      
      // If existing RSVP, pre-fill RSVP fields
      if (data.found_in === 'rsvp') {
        if (data.will_attend) {
          setValue('will_attend', data.will_attend, { shouldValidate: false, shouldDirty: false })
        }
        if (data.guests_count) {
          setValue('guests_count', data.guests_count, { shouldValidate: false, shouldDirty: false })
        }
        if (data.notes) {
          setValue('notes', data.notes, { shouldValidate: false, shouldDirty: false })
        }
      }
      
      // Set phone and country code (read-only after verification)
      setValue('phone', phone, { shouldValidate: false, shouldDirty: true })
      setValue('country_code', countryCode, { shouldValidate: false, shouldDirty: true })
      
      const message = data.found_in === 'rsvp' 
        ? 'Found your existing RSVP! You can update it below.' 
        : 'Phone verified! Please complete your RSVP below.'
      showToast(message, 'success')
    } catch (error: any) {
      // Check for 403 error (removed guest/RSVP)
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.error || 'Access denied. This guest or RSVP has been removed.'
        setPhoneNotInList(true)
        showToast(errorMessage, 'error')
      } else if (error.response?.status === 404) {
        setPhoneNotInList(true)
        showToast('Phone number not found. Please try a different number or contact the host.', 'error')
      } else {
        logError('Error verifying phone:', error)
        showToast('Error verifying phone number. Please try again.', 'error')
      }
    } finally {
      setVerifyingPhone(false)
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
      
      // Show thank you message if registry is disabled OR if it's a private event
      if (!event?.has_registry || !event?.is_public) {
        setShowThankYou(true)
        // Reset form after showing thank you
        reset()
      } else {
        // Redirect to registry after a moment (longer for updates so user can see the change)
        setTimeout(() => {
          window.location.href = `/registry/${slug}`
        }, isUpdate ? 3000 : 2000)
      }
    } catch (error: any) {
      logError('RSVP error:', error)
      
      // Check for 403 error (removed guest/RSVP)
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.error || 'Access denied. This guest or RSVP has been removed.'
        showToast(errorMessage, 'error')
        // Clear existing RSVP state to prevent further attempts
        setExistingRSVP(null)
        // Reset form to prevent submission
        reset()
        return
      }
      
      const errorMsg = error.response?.data?.error || 
                      (error.response?.data ? JSON.stringify(error.response.data) : 'Failed to submit RSVP')
      showToast(errorMsg, 'error')
      // Don't reset form on error - preserve user input
      // Form values will remain intact for user to correct and resubmit
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
          {(() => {
            const { date, location } = getEventDetailsFromConfig(event)
            return (
              <>
                {date && (
                  <p className="text-lg text-gray-700">
                    {(() => {
                      // Parse date string and create date in local timezone to avoid UTC conversion issues
                      // If date is in format "YYYY-MM-DD", parse it as local date
                      let dateObj: Date
                      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        // Date is in YYYY-MM-DD format, parse as local date
                        const [year, month, day] = date.split('-').map(Number)
                        dateObj = new Date(year, month - 1, day) // month is 0-indexed
                      } else {
                        // Try parsing as-is
                        dateObj = new Date(date)
                      }
                      return dateObj.toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    })()}
                  </p>
                )}
                {location && <p className="text-gray-600">{location}</p>}
              </>
            )
          })()}
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

        {/* Thank You Message (shown when registry is disabled) */}
        {showThankYou ? (
          <Card className="bg-white border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green text-2xl text-center">
                Thank You! 🌿
              </CardTitle>
              <CardDescription className="text-center">
                Your RSVP has been confirmed. We're excited to celebrate with you!
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-6 text-center">
                <div className="bg-eco-green-light p-6 rounded-lg">
                  <p className="text-gray-700 text-lg mb-4">
                    <strong>Your response helps us plan better and celebrate sustainably.</strong>
                  </p>
                  <p className="text-gray-600">
                    We'll send you updates via SMS or WhatsApp as the event approaches.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => {
                      setShowThankYou(false)
                      reset()
                    }}
                    className="bg-eco-green hover:bg-green-600 text-white px-8 py-3"
                  >
                    Submit Another RSVP
                  </Button>
                  <Link href={`/invite/${slug}`}>
                    <Button
                      variant="outline"
                      className="border-eco-green text-eco-green px-8 py-3"
                    >
                      View Invitation
                    </Button>
                  </Link>
                </div>

                {/* Company Branding */}
                <div className="pt-6 mt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    Created using{' '}
                    <a
                      href={COMPANY_HOMEPAGE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-eco-green hover:underline"
                    >
                      {BRAND_NAME}
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stage 0: Phone Verification for Private Events */}
            {!event.is_public && !phoneVerified && (
              <Card className="bg-white border-eco-green-light mb-6">
                <CardHeader>
                  <CardTitle className="text-eco-green text-2xl text-center">
                    Private Event
                  </CardTitle>
                  <CardDescription className="text-center">
                    Please verify your phone number to continue
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone Number *</label>
                      <div className="flex gap-2">
                        <CountryCodeSelector
                          name="country_code"
                          defaultValue={event?.country_code || '+91'}
                          onChange={(value) => {
                            setValue('country_code', value, { shouldValidate: true })
                          }}
                          className="w-48"
                          disabled={verifyingPhone}
                        />
                        <Input
                          type="tel"
                          {...register('phone')}
                          placeholder="10-digit phone number"
                          className="flex-1"
                          disabled={verifyingPhone}
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                      )}
                    </div>
                    
                    {phoneNotInList && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          Phone number not found. Please try a different number or contact the host.
                        </p>
                      </div>
                    )}
                    
                    <Button
                      onClick={handlePhoneVerification}
                      disabled={verifyingPhone || !phoneValue || phoneValue.length < 10}
                      className="w-full bg-eco-green hover:bg-green-600 text-white"
                    >
                      {verifyingPhone ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Verifying...
                        </>
                      ) : (
                        'Verify Phone Number'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* RSVP Form */}
            {((!event.is_public && phoneVerified) || event.is_public) ? (
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
                    name="country_code"
                    defaultValue={event?.country_code || '+91'}
                    onChange={(value) => {
                      setValue('country_code', value, { shouldValidate: true })
                    }}
                    className="w-48"
                    disabled={checkingRSVP || (!event.is_public && phoneVerified)}
                  />
                  <div className="flex-1 relative">
                    <Input
                      type="tel"
                      {...register('phone')}
                      placeholder="10-digit phone number"
                      className="flex-1"
                      disabled={checkingRSVP || (!event.is_public && phoneVerified)}
                      readOnly={!event.is_public && phoneVerified}
                    />
                    {checkingRSVP && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-eco-green"></div>
                      </div>
                    )}
                  </div>
                </div>
                {checkingRSVP && (
                  <p className="text-sm text-blue-600 mt-1 flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Checking for existing RSVP... Please wait
                  </p>
                )}
                {!event.is_public && phoneVerified && (
                  <p className="text-xs text-gray-500 mt-1">
                    Phone number verified (read-only)
                  </p>
                )}
                {errors.phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                )}
                {!checkingRSVP && event.is_public && (
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send updates via SMS or WhatsApp
                  </p>
                )}
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
            ) : null}
          </>
        )}

        {/* Link to Registry - Only show if registry is enabled */}
        {event.has_registry && !showThankYou && (
          <div className="text-center mt-8">
            <Link href={`/registry/${slug}`}>
              <Button variant="outline" className="border-eco-green text-eco-green">
                View Gift Registry →
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

