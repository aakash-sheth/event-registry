'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Calendar, Download } from 'lucide-react'
import { Theme } from '@/lib/invite/themes'
import { getGoogleCalendarHref } from '@/lib/calendar'

interface ActionButtonsProps {
  buttons: Array<{
    label: 'Save the Date' | 'RSVP' | 'Registry'
    action: 'calendar' | 'rsvp' | 'registry'
    href?: string
  }>
  theme: Theme
  eventSlug: string
  eventDate?: string
  eventTitle: string
}

export default function ActionButtons({
  buttons,
  theme,
  eventSlug,
  eventDate,
  eventTitle,
}: ActionButtonsProps) {
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)

  const handleSaveTheDate = () => {
    setShowCalendarMenu(!showCalendarMenu)
  }

  const handleGoogleCalendar = () => {
    if (eventDate) {
      const startDate = new Date(eventDate)
      const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000) // 4 hours later

      const googleUrl = getGoogleCalendarHref({
        title: eventTitle,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
      })

      window.open(googleUrl, '_blank')
    }
    setShowCalendarMenu(false)
  }

  const handleDownloadICS = () => {
    window.open(`/api/ics?slug=${eventSlug}`, '_blank')
    setShowCalendarMenu(false)
  }

  const baseButtonStyle: React.CSSProperties = {
    minHeight: '44px',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.2s',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }

  const primaryButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    backgroundColor: theme.palette.primary,
    color: theme.palette.fg,
  }

  const secondaryButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    backgroundColor: `rgba(255, 255, 255, 0.15)`,
    color: theme.palette.fg,
    backdropFilter: 'blur(10px)',
    border: `1px solid rgba(255, 255, 255, 0.2)`,
  }

  return (
    <div className="w-full space-y-3">
      {buttons.map((button, index) => {
        if (button.action === 'calendar') {
          return (
            <div key={index} className="relative">
              <button
                onClick={handleSaveTheDate}
                className="w-full hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
                style={{
                  ...primaryButtonStyle,
                  '--tw-ring-color': theme.palette.primary,
                } as React.CSSProperties}
                aria-expanded={showCalendarMenu}
                aria-haspopup="true"
              >
                {button.label}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showCalendarMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showCalendarMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCalendarMenu(false)}
                  />
                  <div
                    className="absolute top-full left-0 right-0 mt-2 z-20 rounded-lg overflow-hidden shadow-xl backdrop-blur-md"
                    style={{
                      backgroundColor: `rgba(0, 0, 0, 0.8)`,
                      border: `1px solid rgba(255, 255, 255, 0.1)`,
                    }}
                  >
                    <button
                      onClick={handleGoogleCalendar}
                      className="w-full px-4 py-3 text-left hover:bg-white/10 focus:outline-none focus:bg-white/10 flex items-center gap-3"
                      style={{ color: theme.palette.fg }}
                    >
                      <Calendar className="w-5 h-5" />
                      <span>Add to Google Calendar</span>
                    </button>
                    <button
                      onClick={handleDownloadICS}
                      className="w-full px-4 py-3 text-left hover:bg-white/10 focus:outline-none focus:bg-white/10 flex items-center gap-3 border-t border-white/10"
                      style={{ color: theme.palette.fg }}
                    >
                      <Download className="w-5 h-5" />
                      <span>Download .ics file</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        }

        if (button.action === 'rsvp') {
          const href = button.href || `/event/${eventSlug}/rsvp`
          return (
            <Link
              key={index}
              href={href}
              style={secondaryButtonStyle}
              className="w-full hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent block text-center"
            >
              {button.label}
            </Link>
          )
        }

        if (button.action === 'registry') {
          const href = button.href || `/registry/${eventSlug}`
          return (
            <Link
              key={index}
              href={href}
              style={secondaryButtonStyle}
              className="w-full hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent block text-center"
            >
              {button.label}
            </Link>
          )
        }

        return null
      })}
    </div>
  )
}

