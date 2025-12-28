'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, Calendar, Download } from 'lucide-react'
import { InviteConfig } from '@/lib/invite/schema'
import { getGoogleCalendarHref } from '@/lib/calendar'

const DEFAULT_COLORS = {
  fontColor: '#000000',
  primaryColor: '#0D6EFD',
  mutedColor: '#6B7280',
}

export interface CountdownProps {
  targetDate: Date
  config: InviteConfig
  eventSlug?: string
  eventTitle?: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export default function Countdown({ targetDate, config, eventSlug, eventTitle }: CountdownProps) {
  const fontColor = config.customColors?.fontColor || DEFAULT_COLORS.fontColor
  const primaryColor = config.customColors?.primaryColor || DEFAULT_COLORS.primaryColor
  const mutedColor = config.customColors?.mutedColor || DEFAULT_COLORS.mutedColor
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [mounted, setMounted] = useState(false)
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)

  useEffect(() => {
    setMounted(true)
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const target = targetDate.getTime()
      const difference = target - now

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [targetDate])

  // Prevent layout shift by reserving space
  if (!mounted) {
    return (
      <div
        className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6"
        style={{ minHeight: '80px' }}
        aria-hidden="true"
      >
        <div className="text-2xl md:text-3xl font-bold" style={{ color: fontColor }}>
          00
        </div>
      </div>
    )
  }

  const formatNumber = (num: number): string => {
    return String(num).padStart(2, '0')
  }

  const handleSaveTheDate = () => {
    setShowCalendarMenu(!showCalendarMenu)
  }

  const handleGoogleCalendar = () => {
    const startDate = targetDate
    const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000) // 4 hours later

    const googleUrl = getGoogleCalendarHref({
      title: eventTitle || 'Event',
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
    })

    window.open(googleUrl, '_blank')
    setShowCalendarMenu(false)
  }

  const handleDownloadICS = () => {
    if (eventSlug) {
      window.open(`/api/ics?slug=${eventSlug}`, '_blank')
    }
    setShowCalendarMenu(false)
  }

  const timeUnits = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ]

  return (
    <div className="flex flex-col items-center gap-6">
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Countdown to event: ${formatNumber(timeLeft.days)} days, ${formatNumber(timeLeft.hours)} hours, ${formatNumber(timeLeft.minutes)} minutes, ${formatNumber(timeLeft.seconds)} seconds`}
      className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6"
    >
      {timeUnits.map((unit, index) => (
        <div
          key={unit.label}
          className="flex flex-col md:flex-row items-center gap-1 md:gap-2"
        >
          <div
            className="text-2xl md:text-3xl font-bold tabular-nums"
            style={{
              color: fontColor,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {formatNumber(unit.value)}
          </div>
          <div
            className="text-xs md:text-sm uppercase tracking-wider"
            style={{
              color: mutedColor,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            {unit.label}
          </div>
          {index < timeUnits.length - 1 && (
            <span
              className="hidden md:inline mx-2 text-xl"
              style={{ color: mutedColor }}
            >
              •
            </span>
          )}
        </div>
      ))}
      </div>
      
      {/* Save the Date Button */}
      <div className="relative">
        <button
          onClick={handleSaveTheDate}
          className="px-6 py-3 rounded-lg font-semibold text-base flex items-center gap-2 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all"
          style={{
            backgroundColor: primaryColor,
            color: fontColor,
            minHeight: '44px',
          }}
          aria-expanded={showCalendarMenu}
          aria-haspopup="true"
        >
          Save the Date
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
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 rounded-lg overflow-hidden shadow-xl backdrop-blur-md min-w-[200px]"
              style={{
                backgroundColor: `rgba(0, 0, 0, 0.8)`,
                border: `1px solid rgba(255, 255, 255, 0.1)`,
              }}
            >
              <button
                onClick={handleGoogleCalendar}
                className="w-full px-4 py-3 text-left hover:bg-white/10 focus:outline-none focus:bg-white/10 flex items-center gap-3"
                style={{ color: fontColor }}
              >
                <Calendar className="w-5 h-5" />
                <span>Add to Google Calendar</span>
              </button>
              <button
                onClick={handleDownloadICS}
                className="w-full px-4 py-3 text-left hover:bg-white/10 focus:outline-none focus:bg-white/10 flex items-center gap-3 border-t border-white/10"
                style={{ color: fontColor }}
              >
                <Download className="w-5 h-5" />
                <span>Download .ics file</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

