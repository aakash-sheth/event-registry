import React from 'react'
import { MapPin } from 'lucide-react'
import { EventDetailsTileSettings } from '@/lib/invite/schema'
import { getTimezoneFromLocation, formatTimeInTimezone } from '@/lib/invite/timezone'
import { getAutomaticLabelColor } from '@/lib/invite/colorUtils'
import { isValidMapUrl, getEmbedUrl, canShowMap, generateMapUrlFromLocation, generateMapUrlFromCoordinates } from '@/lib/invite/mapUtils'

// Border style configurations (duplicated from EventDetailsTile for SSR)
const BORDER_STYLES = {
  elegant: {
    symbol: '❦',
    lineStyle: 'gradient',
    showSymbol: true,
  },
  minimal: {
    symbol: '',
    lineStyle: 'solid',
    showSymbol: false,
  },
  ornate: {
    symbol: '✿',
    lineStyle: 'gradient',
    showSymbol: true,
  },
  modern: {
    symbol: '•',
    lineStyle: 'dotted',
    showSymbol: true,
  },
  classic: {
    symbol: '',
    lineStyle: 'double',
    showSymbol: false,
  },
  vintage: {
    symbol: '✦',
    lineStyle: 'gradient',
    showSymbol: true,
  },
  none: {
    symbol: '',
    lineStyle: 'none',
    showSymbol: false,
  },
} as const

function renderDecorativeBorder(
  style: string,
  color: string,
  width: number,
  customSymbol?: string
) {
  const borderConfig = BORDER_STYLES[style as keyof typeof BORDER_STYLES] || BORDER_STYLES.elegant
  const symbol = customSymbol !== undefined ? customSymbol : borderConfig.symbol
  
  if (style === 'none') {
    return null
  }
  
  // Render based on line style
  if (borderConfig.lineStyle === 'gradient') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ 
            color,
            height: `${width}px`,
          }}
        />
        {borderConfig.showSymbol && symbol && (
          <div 
            className="mx-4 text-2xl"
            style={{ color }}
          >
            {symbol}
          </div>
        )}
        <div 
          className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ 
            color,
            height: `${width}px`,
          }}
        />
      </div>
    )
  }
  
  if (borderConfig.lineStyle === 'solid') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1"
          style={{ 
            borderTop: `${width}px solid ${color}`,
          }}
        />
      </div>
    )
  }
  
  if (borderConfig.lineStyle === 'dotted') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1 h-px border-t-2 border-dotted"
          style={{ 
            borderColor: color,
            borderTopWidth: `${width}px`,
          }}
        />
        {borderConfig.showSymbol && symbol && (
          <div 
            className="mx-4 text-2xl"
            style={{ color }}
          >
            {symbol}
          </div>
        )}
        <div 
          className="flex-1 h-px border-t-2 border-dotted"
          style={{ 
            borderColor: color,
            borderTopWidth: `${width}px`,
          }}
        />
      </div>
    )
  }
  
  if (borderConfig.lineStyle === 'double') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1"
          style={{ 
            borderTop: `${width}px double ${color}`,
          }}
        />
      </div>
    )
  }
  
  return null
}

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

  // Get border settings with defaults
  const borderStyle = settings.borderStyle || 'elegant'
  const borderColor = settings.borderColor || '#D1D5DB'
  const borderWidth = settings.borderWidth || 1
  const decorativeSymbol = settings.decorativeSymbol
  const backgroundColor = settings.backgroundColor
  const borderRadius = settings.borderRadius ?? 0
  
  const topBorder = renderDecorativeBorder(borderStyle, borderColor, borderWidth, decorativeSymbol)
  const bottomBorder = renderDecorativeBorder(borderStyle, borderColor, borderWidth, decorativeSymbol)

  return (
    <div 
      className="w-full py-12 px-6 text-center"
      style={{
        backgroundColor: backgroundColor || 'transparent',
        borderRadius: `${borderRadius}px`,
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Decorative top border */}
        {topBorder && (
          <div className="mb-8">
            {topBorder}
          </div>
        )}

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

          {settings.location && (() => {
            // Determine map URL - prioritize coordinates, then mapUrl
            let mapUrl = settings.mapUrl
            if (settings.coordinates) {
              mapUrl = generateMapUrlFromCoordinates(settings.coordinates.lat, settings.coordinates.lng)
            }
            
            // Check if map can be shown (location must be verified)
            const canDisplay = canShowMap(settings)
            
            return (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest font-light italic mb-3" style={{ color: labelColor }}>
                  Location
                </div>
                <div className="text-xl md:text-2xl font-normal leading-relaxed flex items-center justify-center gap-2" style={{ color: settings.fontColor || '#1F2937' }}>
                  <span>{settings.location}</span>
                  {canDisplay && mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 transition-colors ml-2"
                      aria-label="Open location in maps"
                    >
                      <MapPin className="w-4 h-4 text-gray-600" />
                    </a>
                  )}
                </div>
                
                {/* Embedded Map - only show if verified, enabled, and valid */}
                {canDisplay && settings.showMap && mapUrl && isValidMapUrl(mapUrl) && (() => {
                  const embedUrl = getEmbedUrl(mapUrl, settings.coordinates)
                  
                  if (embedUrl) {
                    return (
                      <div className="mt-6 w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        <iframe
                          src={embedUrl}
                          width="100%"
                          height="300"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Event location map"
                          className="w-full"
                        />
                      </div>
                    )
                  }
                  
                  // If URL is valid but not embeddable (e.g., Apple Maps, short links), show helpful message
                  return (
                    <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 text-center">
                        Map preview not available for this link type. 
                        <a 
                          href={mapUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline ml-1"
                        >
                          Open in maps
                        </a>
                      </p>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

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
        {bottomBorder && (
          <div className="mt-10 mb-8">
            {bottomBorder}
          </div>
        )}
      
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
