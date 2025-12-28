'use client'

import React, { useState } from 'react'
import { MapPin, ChevronDown, Calendar, Download } from 'lucide-react'
import { EventDetailsTileSettings } from '@/lib/invite/schema'
import { getTimezoneFromLocation, formatTimeInTimezone } from '@/lib/invite/timezone'
import { getGoogleCalendarHref } from '@/lib/calendar'
import { getAutomaticLabelColor, hexToRgb, getBrightnessPercentage } from '@/lib/invite/colorUtils'

export interface EventDetailsTileProps {
  settings: EventDetailsTileSettings
  preview?: boolean
  eventSlug?: string
  eventTitle?: string
  eventDate?: string
}

export default function EventDetailsTile({ settings, preview = false, eventSlug, eventTitle, eventDate }: EventDetailsTileProps) {
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)
  
  // Calculate button colors based on settings.buttonColor
  const buttonColor = settings.buttonColor || '#1F2937'
  const rgb = hexToRgb(buttonColor)
  const brightness = rgb ? getBrightnessPercentage(rgb.r, rgb.g, rgb.b) : 0
  const textColor = brightness < 50 ? '#FFFFFF' : '#1F2937'
  const hoverTextColor = brightness < 50 ? '#1F2937' : '#FFFFFF'
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

  const handleSaveTheDate = () => {
    setShowCalendarMenu(!showCalendarMenu)
  }

  const handleGoogleCalendar = () => {
    const dateToUse = settings.date || eventDate
    if (dateToUse) {
      let startDate: Date
      try {
        if (dateToUse.includes('T')) {
          startDate = new Date(dateToUse)
        } else {
          const [year, month, day] = dateToUse.split('-').map(Number)
          startDate = new Date(year, month - 1, day)
        }
        
        // Add time if available
        if (settings.time) {
          const [hours, minutes] = settings.time.split(':').map(Number)
          if (!isNaN(hours) && !isNaN(minutes)) {
            startDate.setHours(hours, minutes || 0, 0, 0)
          }
        } else {
          startDate.setHours(0, 0, 0, 0)
        }
        
        const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000) // 4 hours later

        const googleUrl = getGoogleCalendarHref({
          title: eventTitle || 'Event',
          startISO: startDate.toISOString(),
          endISO: endDate.toISOString(),
        })

        window.open(googleUrl, '_blank')
      } catch (error) {
        console.error('Error creating calendar event:', error)
      }
    }
    setShowCalendarMenu(false)
  }

  const handleDownloadICS = () => {
    if (eventSlug) {
      window.open(`/api/ics?slug=${eventSlug}`, '_blank')
    }
    setShowCalendarMenu(false)
  }

  if (preview) {
    return (
      <div className="w-full py-12 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          {/* Decorative top border */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            <div className="mx-4 text-gray-400 text-2xl">❦</div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          </div>

          {(() => {
            const labelColor = getAutomaticLabelColor(settings.fontColor)
            return (
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
            )
          })()}

          {/* Decorative bottom border */}
          <div className="flex items-center justify-center mt-10 mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            <div className="mx-4 text-gray-400 text-2xl">❦</div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          </div>
        
          {/* Save the Date Button */}
          <div className="relative mt-8">
            <button
              onClick={handleSaveTheDate}
              className="px-8 py-3 rounded-sm font-light text-sm tracking-widest uppercase border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all mx-auto"
              style={{
                minHeight: '44px',
                letterSpacing: '0.15em',
                borderColor: buttonColor,
                color: buttonColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = buttonColor
                e.currentTarget.style.color = hoverTextColor
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = buttonColor
              }}
              aria-expanded={showCalendarMenu}
              aria-haspopup="true"
            >
              Save the Date
              <ChevronDown
                className={`w-4 h-4 inline-block ml-2 transition-transform ${showCalendarMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showCalendarMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCalendarMenu(false)}
                />
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 rounded-sm overflow-hidden shadow-xl backdrop-blur-md min-w-[200px] border border-gray-200"
                  style={{
                    backgroundColor: `rgba(255, 255, 255, 0.95)`,
                  }}
                >
                  <button
                    onClick={handleGoogleCalendar}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center gap-3 text-gray-800 font-light"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>Add to Google Calendar</span>
                  </button>
                  <button
                    onClick={handleDownloadICS}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center gap-3 border-t border-gray-200 text-gray-800 font-light"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download .ics file</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const fontColor = settings.fontColor || '#374151' // Default to gray-700 equivalent
  const labelColor = getAutomaticLabelColor(settings.fontColor)
  return (
    <div className="w-full py-6 px-4 border border-gray-200 rounded-sm bg-gray-50">
      <div className="space-y-3 text-sm" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {settings.date && (
          <p>
            <span className="text-xs uppercase tracking-widest font-light italic mr-2" style={{ color: labelColor }}>Date:</span>
            <span className="font-normal" style={{ color: fontColor }}>{formatDate(settings.date)}</span>
          </p>
        )}
        {settings.time && (
          <p>
            <span className="text-xs uppercase tracking-widest font-light italic mr-2" style={{ color: labelColor }}>Time:</span>
            <span className="font-normal" style={{ color: fontColor }}>{formatTime(settings.time)}</span>
          </p>
        )}
        {settings.location && (
          <p>
            <span className="text-xs uppercase tracking-widest font-light italic mr-2" style={{ color: labelColor }}>Location:</span>
            <span className="font-normal" style={{ color: fontColor }}>{settings.location}</span>
          </p>
        )}
        {settings.dressCode && (
          <p>
            <span className="text-xs uppercase tracking-widest font-light italic mr-2" style={{ color: labelColor }}>Dress Code:</span>
            <span className="font-normal italic" style={{ color: fontColor }}>{settings.dressCode}</span>
          </p>
        )}
      </div>
    </div>
  )
}

