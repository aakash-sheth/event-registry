'use client'

import React from 'react'
import { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import Link from 'next/link'

interface FeatureButtonsTileProps {
  settings: FeatureButtonsTileSettings
  preview?: boolean
  hasRsvp?: boolean
  hasRegistry?: boolean
  eventSlug?: string
}

export default function FeatureButtonsTile({
  settings,
  preview = false,
  hasRsvp = false,
  hasRegistry = false,
  eventSlug,
}: FeatureButtonsTileProps) {
  const buttonColor = settings.buttonColor || '#0D6EFD'
  const buttons: Array<{ label: string; href: string }> = []

  if (hasRsvp) {
    buttons.push({ label: 'RSVP', href: `/event/${eventSlug}/rsvp` })
  }
  if (hasRegistry) {
    buttons.push({ label: 'Registry', href: `/registry/${eventSlug}` })
  }

  if (buttons.length === 0) {
    if (preview) return null
    return (
      <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
        <p className="text-gray-400 text-sm">No features enabled</p>
      </div>
    )
  }

  if (preview) {
    if (buttons.length === 1) {
      return (
        <div className="w-full py-8 px-4">
          <div className="flex justify-center">
            <Link
              href={buttons[0].href}
              className="px-8 py-3 rounded-lg font-semibold text-white text-center"
              style={{ backgroundColor: buttonColor }}
            >
              {buttons[0].label}
            </Link>
          </div>
        </div>
      )
    }

    // Two buttons side by side
    return (
      <div className="w-full py-8 px-4">
        <div className="flex gap-4 justify-center">
          {buttons.map((button, idx) => (
            <Link
              key={idx}
              href={button.href}
              className="flex-1 max-w-[200px] px-6 py-3 rounded-lg font-semibold text-white text-center"
              style={{ backgroundColor: buttonColor }}
            >
              {button.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // Settings preview
  return (
    <div className="w-full py-4 px-4 border rounded">
      <div className="flex gap-2 justify-center">
        {buttons.map((button, idx) => (
          <div
            key={idx}
            className="px-4 py-2 rounded text-sm text-white"
            style={{ backgroundColor: buttonColor }}
          >
            {button.label}
          </div>
        ))}
      </div>
    </div>
  )
}

