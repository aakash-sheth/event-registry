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
  event_type: z.enum([
    'wedding', 'engagement', 'reception', 'anniversary', 'birthday', 'baby_shower', 'bridal_shower',
    'bachelor_party', 'bachelorette_party', 'gender_reveal', 'naming_ceremony', 'housewarming',
    'graduation', 'retirement', 'religious_ceremony', 'puja', 'satsang', 'church_service',
    'bar_mitzvah', 'bat_mitzvah', 'communion', 'confirmation', 'corporate_event', 'conference',
    'seminar', 'workshop', 'networking', 'product_launch', 'team_building', 'award_ceremony',
    'fundraiser', 'charity_event', 'community_event', 'festival', 'cultural_event', 'exhibition',
    'art_show', 'concert', 'music_event', 'theater', 'comedy_show', 'sports_event',
    'dinner_party', 'brunch', 'cocktail_party', 'tea_party', 'potluck', 'other'
  ]),
  date: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('IN'),
  timezone: z.string().default('Asia/Kolkata'),
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
      timezone: 'Asia/Kolkata',
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
                  <optgroup label="Life Events">
                    <option value="wedding">Wedding</option>
                    <option value="engagement">Engagement</option>
                    <option value="reception">Reception</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="birthday">Birthday</option>
                    <option value="baby_shower">Baby Shower</option>
                    <option value="bridal_shower">Bridal Shower</option>
                    <option value="bachelor_party">Bachelor Party</option>
                    <option value="bachelorette_party">Bachelorette Party</option>
                    <option value="gender_reveal">Gender Reveal</option>
                    <option value="naming_ceremony">Naming Ceremony</option>
                    <option value="housewarming">Housewarming</option>
                    <option value="graduation">Graduation</option>
                    <option value="retirement">Retirement</option>
                  </optgroup>
                  <optgroup label="Religious & Ceremonial">
                    <option value="religious_ceremony">Religious Ceremony</option>
                    <option value="puja">Puja</option>
                    <option value="satsang">Satsang</option>
                    <option value="church_service">Church Service</option>
                    <option value="bar_mitzvah">Bar Mitzvah</option>
                    <option value="bat_mitzvah">Bat Mitzvah</option>
                    <option value="communion">Communion</option>
                    <option value="confirmation">Confirmation</option>
                  </optgroup>
                  <optgroup label="Professional & Business">
                    <option value="corporate_event">Corporate Event</option>
                    <option value="conference">Conference</option>
                    <option value="seminar">Seminar</option>
                    <option value="workshop">Workshop</option>
                    <option value="networking">Networking Event</option>
                    <option value="product_launch">Product Launch</option>
                    <option value="team_building">Team Building</option>
                    <option value="award_ceremony">Award Ceremony</option>
                  </optgroup>
                  <optgroup label="Social & Community">
                    <option value="fundraiser">Fundraiser</option>
                    <option value="charity_event">Charity Event</option>
                    <option value="community_event">Community Event</option>
                    <option value="festival">Festival</option>
                    <option value="cultural_event">Cultural Event</option>
                    <option value="exhibition">Exhibition</option>
                    <option value="art_show">Art Show</option>
                  </optgroup>
                  <optgroup label="Entertainment">
                    <option value="concert">Concert</option>
                    <option value="music_event">Music Event</option>
                    <option value="theater">Theater</option>
                    <option value="comedy_show">Comedy Show</option>
                    <option value="sports_event">Sports Event</option>
                  </optgroup>
                  <optgroup label="Food & Dining">
                    <option value="dinner_party">Dinner Party</option>
                    <option value="brunch">Brunch</option>
                    <option value="cocktail_party">Cocktail Party</option>
                    <option value="tea_party">Tea Party</option>
                    <option value="potluck">Potluck</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="other">Other</option>
                  </optgroup>
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
                <label className="block text-sm font-medium mb-1">Timezone</label>
                <select
                  {...register('timezone')}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="Asia/Kolkata">India (IST) — Asia/Kolkata</option>
                  <option value="America/New_York">US East — America/New_York</option>
                  <option value="America/Chicago">US Central — America/Chicago</option>
                  <option value="America/Denver">US Mountain — America/Denver</option>
                  <option value="America/Los_Angeles">US Pacific — America/Los_Angeles</option>
                  <option value="Europe/London">UK — Europe/London</option>
                  <option value="Asia/Dubai">UAE — Asia/Dubai</option>
                  <option value="Asia/Singapore">Singapore — Asia/Singapore</option>
                  <option value="Australia/Sydney">Australia — Australia/Sydney</option>
                  <option value="Pacific/Auckland">New Zealand — Pacific/Auckland</option>
                  <option value="UTC">UTC</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Times will be shown exactly as you enter them, using this timezone.
                </p>
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

