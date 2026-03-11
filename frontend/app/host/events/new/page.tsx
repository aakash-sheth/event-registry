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
import WizardProgress from '@/components/host/WizardProgress'

const eventSchema = z.object({
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
  ], { errorMap: () => ({ message: 'Please select an event type' }) }),
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
      event_type: '' as any,
      country: 'IN',
      timezone: 'Asia/Kolkata',
      is_public: true,
      has_rsvp: true,
      has_registry: true,
    } as EventForm,
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
      logDebug('Event created successfully, navigating to card step:', eventId)
      showToast('Event created! Now let\'s create your greeting card.', 'success')
      setTimeout(() => {
        router.push(`/host/events/${eventId}/card`)
      }, 100)
    } catch (error: unknown) {
      logError('Event creation error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <WizardProgress currentStep={1} />
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
                <label className="block text-sm font-medium mb-1">Event Title</label>
                <Input {...register('title')} placeholder="Your event name" />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  What type of event are you hosting?
                </label>
                <select
                  {...register('event_type')}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="" disabled>Wedding, birthday, corporate, and more…</option>
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
                {errors.event_type && (
                  <p className="text-red-500 text-sm mt-1">{errors.event_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <Input type="date" {...register('date')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City (leave blank for virtual)</label>
                  <Input {...register('city')} placeholder="e.g. New York, London, Mumbai" />
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
                  <span className="relative group cursor-default">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none">?</span>
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 w-64 rounded-md bg-gray-800 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                      When public, anyone with the link can view your invite, RSVP, and purchase gifts — even if they&apos;re not on your guest list. When private, only people you&apos;ve invited can participate.
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Features</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('has_rsvp')}
                    className="form-checkbox text-eco-green"
                  />
                  <span className="text-sm">Enable RSVP</span>
                  <span className="relative group cursor-default">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none">?</span>
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 w-64 rounded-md bg-gray-800 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                      RSVP lets guests confirm whether they&apos;ll attend. You&apos;ll see a live headcount as responses come in. You can enable or disable this later.
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('has_registry')}
                    className="form-checkbox text-eco-green"
                  />
                  <span className="text-sm">Enable Gift Registry</span>
                  <span className="relative group cursor-default">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none">?</span>
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 w-64 rounded-md bg-gray-800 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                      A gift registry lets guests contribute money or buy gifts for your event. You add items to the registry and guests can browse and purchase them. You can enable or disable this later.
                    </span>
                  </span>
                </label>
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
                  {loading ? 'Creating...' : 'Next: Create Greeting Card'}
                </Button>
              </div>
              <p className="text-sm text-center text-gray-600 mt-4">
                You can enable RSVP or Registry later from your Dashboard.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
