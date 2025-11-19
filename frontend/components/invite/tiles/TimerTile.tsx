'use client'

import React, { useState, useEffect } from 'react'
import { TimerTileSettings } from '@/lib/invite/schema'

interface TimerTileProps {
  settings: TimerTileSettings
  preview?: boolean
  eventDate?: string
  eventTime?: string // Time from event details (e.g., "18:00")
  eventSlug?: string
  eventTitle?: string
}

export default function TimerTile({ settings, preview = false, eventDate, eventTime, eventSlug, eventTitle }: TimerTileProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)

  useEffect(() => {
    if (!eventDate || !settings.enabled) {
      setTimeRemaining(null)
      return
    }

    const calculateTimeRemaining = () => {
      if (!eventDate) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const now = new Date()
      // Parse date string (handles both ISO date strings and date-only strings)
      let target: Date
      try {
        if (eventDate.includes('T')) {
          // ISO datetime string
          target = new Date(eventDate)
        } else {
          // Date-only string (YYYY-MM-DD), parse as local date
          const [year, month, day] = eventDate.split('-').map(Number)
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            throw new Error('Invalid date format')
          }
          target = new Date(year, month - 1, day)
        }
        
        // Validate the date
        if (isNaN(target.getTime())) {
          throw new Error('Invalid date')
        }
        
        // Combine date and time if time is provided
        if (eventTime) {
          const [hours, minutes] = eventTime.split(':').map(Number)
          if (!isNaN(hours) && !isNaN(minutes)) {
            target.setHours(hours, minutes || 0, 0, 0)
          }
        } else {
          // If no time provided, default to midnight
          target.setHours(0, 0, 0, 0)
        }
      } catch (error) {
        console.error('Error parsing event date:', error, eventDate)
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      
      const diff = target.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining({ days, hours, minutes, seconds })
    }

    calculateTimeRemaining()
    const interval = setInterval(calculateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [eventDate, eventTime, settings.enabled])

  if (!settings.enabled || !timeRemaining) {
    if (preview) return null
    return (
      <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
        <p className="text-gray-400">Timer disabled</p>
      </div>
    )
  }


  if (preview) {
    // Determine circle color and text color
    const circleColor = settings.circleColor || '#E55A9E'
    const isTransparent = circleColor === 'transparent'
    const backgroundColor = isTransparent ? 'transparent' : circleColor
    // Use custom text color if provided, otherwise use default (black for transparent, white for colored)
    const textColor = settings.textColor || (isTransparent ? '#000000' : '#ffffff')

    const CircleComponent = ({ value, label }: { value: number; label: string }) => (
      <div className="flex flex-col items-center justify-center">
        <div 
          className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex flex-col items-center justify-center ${isTransparent ? '' : 'border-2'}`}
          style={{ 
            backgroundColor,
            color: textColor,
            borderColor: 'transparent',
            borderWidth: '0',
          }}
        >
          <div className={`text-2xl md:text-3xl font-bold`} style={{ color: textColor }}>
            {value}
          </div>
          <div className={`text-xs md:text-sm font-medium mt-0.5`} style={{ color: textColor }}>
            {label}
          </div>
        </div>
      </div>
    )

    return (
      <div className="w-full py-8 px-4 flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
          <CircleComponent value={timeRemaining.days} label="DAYS" />
          <CircleComponent value={timeRemaining.hours} label="HOURS" />
          <CircleComponent value={timeRemaining.minutes} label="MINUTES" />
        </div>
      </div>
    )
  }

  // Settings preview
  return (
    <div className="w-full py-4 px-4 text-center border rounded">
      <p className="text-sm text-gray-600">Timer enabled - Circle format</p>
    </div>
  )
}

