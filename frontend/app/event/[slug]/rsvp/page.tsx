'use client'

import { useEffect, useState } from 'react'
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

export default function RSVPPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { showToast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  useEffect(() => {
    fetchEvent()
  }, [slug])

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
      
      await api.post(`/api/events/${event?.id}/rsvp/`, {
        name: data.name,
        phone: formattedPhone,
        country_code: countryCode,
        email: data.email || '',
        will_attend: data.will_attend,
        guests_count: data.guests_count,
        notes: data.notes || '',
        source_channel: 'link',
      })
      showToast('RSVP confirmed! 🌿 Thanks for helping us plan better.', 'success')
      // Redirect to registry after a moment
      setTimeout(() => {
        window.location.href = `/registry/${slug}`
      }, 2000)
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
              Confirm your attendance 🌿
            </CardTitle>
            <CardDescription>
              Help us plan better and reduce waste with accurate RSVPs
            </CardDescription>
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
                disabled={submitting}
                className="w-full bg-eco-green hover:bg-green-600 text-white py-6 text-lg"
              >
                {submitting ? 'Submitting...' : 'Confirm RSVP 🌿'}
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

