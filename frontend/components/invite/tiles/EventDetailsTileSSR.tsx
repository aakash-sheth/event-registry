import React from 'react'
import { MapPin } from 'lucide-react'
import { EventDetailsTileSettings } from '@/lib/invite/schema'
import { getTimezoneFromLocation, formatTimeInTimezone } from '@/lib/invite/timezone'
import { getAutomaticLabelColor } from '@/lib/invite/colorUtils'

interface EventDetailsTileSSRProps {
  settings: EventDetailsTileSettings
  eventSlug?: string
  eventTitle?: string
  eventDate?: string
}

/**
 * Server-safe version of EventDetailsTile
 * Renders date, time, location, dress code, and "Save the Date" button
 * No useState for calendar menu (can be added client-side after hydration)
 */
export default function EventDetailsTileSSR({ 
  settings, 
  eventSlug, 
  eventTitle, 
  eventDate 
}: EventDetailsTileSSRProps) {
  const formatDate = (dateString: string) => {
    try {
      let date: Date
      // Handle date-only strings (YYYY-MM-DD) as local dates to avoid timezone issues
      if (dateString.includes('T')) {
        // ISO datetime string
        date = new Date(dateString)
      } else {
        // Date-only string (YYYY-MM-DD), parse as local date
        const [year, month, day] = dateString.split('-').map(Number)
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          return dateString
        }
        date = new Date(year, month - 1, day)
      }
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return timeString
    
    // Get timezone from location
    const timezone = getTimezoneFromLocation(settings.location || '')
    
    // Format time in the event location's timezone
    return formatTimeInTimezone(timeString, timezone, settings.date)
  }

  // Calculate button colors based on settings.buttonColor
  const buttonColor = settings.buttonColor || '#1F2937'
  
  // For SSR, we'll use a simple brightness check (can be enhanced client-side)
  // Default to dark button with light text
  const textColor = '#FFFFFF'
  const hoverTextColor = '#1F2937'

  const labelColor = getAutomaticLabelColor(settings.fontColor)

  return (
    <div className="w-full py-12 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        {/* Decorative top border */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          <div className="mx-4 text-gray-400 text-2xl">❦</div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        </div>

        <div className="space-y-8" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {settings.date && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest font-light italic mb-3" style={{ color: labelColor }}>
                Date
              </div>
              <div className="text-xl md:text-2xl font-normal leading-relaxed" style={{ color: settings.fontColor || '#1F2937' }}>
                {formatDate(settings.date)}
              </div>
            </div>
          )}

          {settings.time && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest font-light italic mb-3" style={{ color: labelColor }}>
                Time
              </div>
              <div className="text-xl md:text-2xl font-normal leading-relaxed" style={{ color: settings.fontColor || '#1F2937' }}>
                {formatTime(settings.time)}
              </div>
            </div>
          )}

          {settings.location && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest font-light italic mb-3" style={{ color: labelColor }}>
                Location
              </div>
              <div className="text-xl md:text-2xl font-normal leading-relaxed flex items-center justify-center gap-2" style={{ color: settings.fontColor || '#1F2937' }}>
                <span>{settings.location}</span>
                {settings.mapUrl && (
                  <a
                    href={settings.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 transition-colors ml-2"
                    aria-label="Open location in maps"
                  >
                    <MapPin className="w-4 h-4 text-gray-600" />
                  </a>
                )}
              </div>
            </div>
          )}

          {settings.dressCode && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest font-light italic mb-3" style={{ color: labelColor }}>
                Dress Code
              </div>
              <div className="text-xl md:text-2xl font-normal leading-relaxed italic" style={{ color: settings.fontColor || '#1F2937' }}>
                {settings.dressCode}
              </div>
            </div>
          )}
        </div>

        {/* Decorative bottom border */}
        <div className="flex items-center justify-center mt-10 mb-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          <div className="mx-4 text-gray-400 text-2xl">❦</div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        </div>
      
        {/* Save the Date Button - SSR version with direct link to ICS */}
        <div className="relative mt-8">
          {eventSlug ? (
            <a
              href={`/api/ics?slug=${eventSlug}`}
              className="inline-block px-8 py-3 rounded-sm font-light text-sm tracking-widest uppercase border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all"
              style={{
                minHeight: '44px',
                letterSpacing: '0.15em',
                borderColor: buttonColor,
                color: buttonColor,
                backgroundColor: 'transparent',
              }}
            >
              Save the Date
            </a>
          ) : (
            <button
              className="px-8 py-3 rounded-sm font-light text-sm tracking-widest uppercase border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all"
              style={{
                minHeight: '44px',
                letterSpacing: '0.15em',
                borderColor: buttonColor,
                color: buttonColor,
                backgroundColor: 'transparent',
              }}
            >
              Save the Date
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
