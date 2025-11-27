'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { COUNTRY_CODES } from '@/lib/countryCodesFull'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'

const eventSchema = z.object({
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  title: z.string().min(1, 'Title is required'),
  event_type: z.enum(['wedding', 'engagement', 'reception', 'other']),
  date: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('IN'),
  is_public: z.boolean().default(true),
  has_rsvp: z.boolean().default(true),
  has_registry: z.boolean().default(true),
})

type EventForm = z.infer<typeof eventSchema>

export default function NewEventPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_type: 'wedding',
      country: 'IN',
      is_public: true,
      has_rsvp: true,
      has_registry: true,
    },
  })

  const onSubmit = async (data: EventForm) => {
    setLoading(true)
    try {
      const response = await api.post('/api/events/', data)
      const eventId = response.data.id
      if (!eventId) {
        logError('Event ID not found in response:', response.data)
        showToast('Event created but ID not found. Please refresh the dashboard.', 'error')
        router.push('/host/dashboard')
        return
      }
      logDebug('Event created successfully, navigating to:', eventId)
      showToast('Event created successfully!', 'success')
      // Small delay to ensure state is updated
      setTimeout(() => {
        router.push(`/host/events/${eventId}`)
      }, 100)
    } catch (error: any) {
      logError('Event creation error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-eco-green">Create Your Event</h1>
        <p className="text-lg text-gray-700 mb-8">Start with your basic details — you can add RSVP or a Gift Registry anytime.</p>
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Slug (URL-friendly identifier)
                </label>
                <Input
                  {...register('slug')}
                  placeholder="john-jane-wedding"
                />
                {errors.slug && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.slug.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Used in URL: /registry/your-slug
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input {...register('title')} placeholder="John & Jane's Wedding" />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Event Type
                </label>
                <select
                  {...register('event_type')}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="wedding">Wedding</option>
                  <option value="engagement">Engagement</option>
                  <option value="reception">Reception</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <Input type="date" {...register('date')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <Input {...register('city')} placeholder="Mumbai" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Country</label>
                  <select
                    {...register('country')}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(COUNTRY_CODES)
                      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                      .map(([iso, info]) => (
                        <option key={iso} value={iso}>
                          {info.flag} {info.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('is_public')}
                    className="form-checkbox text-eco-green"
                  />
                  <span>Make this event public</span>
                </label>
              </div>

              {/* Feature Toggles */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-eco-green mb-4">Event Features</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose which features you want to enable for your event. You can change these later.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register('has_rsvp')}
                        className="form-checkbox text-eco-green"
                      />
                      <div>
                        <span className="font-medium">Enable RSVP</span>
                        <p className="text-xs text-gray-500">Allow guests to confirm their attendance</p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register('has_registry')}
                        className="form-checkbox text-eco-green"
                      />
                      <div>
                        <span className="font-medium">Enable Gift Registry</span>
                        <p className="text-xs text-gray-500">Allow guests to purchase gifts from your registry</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                >
                  {loading ? 'Creating...' : 'Create Event →'}
                </Button>
              </div>
              <p className="text-sm text-center text-gray-600 mt-4">
                🌿 You can enable RSVP or Registry later from your Dashboard.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

