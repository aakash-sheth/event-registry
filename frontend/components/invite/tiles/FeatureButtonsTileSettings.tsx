'use client'

import React from 'react'
import type { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { Input } from '@/components/ui/input'
import { ExternalLink } from 'lucide-react'

interface FeatureButtonsTileSettingsProps {
  settings: FeatureButtonsTileSettings
  onChange: (settings: FeatureButtonsTileSettings) => void
  hasRsvp?: boolean
  hasRegistry?: boolean
  eventId?: number
}

export default function FeatureButtonsTileSettings({ 
  settings, 
  onChange, 
  hasRsvp = false, 
  hasRegistry = false,
  eventId,
}: FeatureButtonsTileSettingsProps) {
  const currentVariant = settings.buttonVariant ?? 'classic'

  return (
    <div className="space-y-4">
      {/* Button Style */}
      <div>
        <label className="block text-sm font-medium mb-1">Button Style</label>
        <select
          value={currentVariant}
          onChange={(e) => onChange({ ...settings, buttonVariant: e.target.value as FeatureButtonsTileSettings['buttonVariant'] })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="classic">Classic</option>
          <option value="gloss">Gloss</option>
          <option value="soft">Soft</option>
          <option value="metal">Metal</option>
          <option value="raised">Raised</option>
          <option value="glow">Glow</option>
          <option value="bracket">Bracket</option>
          <option value="shimmer">Shimmer</option>
          <option value="ornate">Ornate</option>
          <option value="link">Link</option>
        </select>
      </div>

      {/* Corner Radius — hidden for link variant */}
      {currentVariant !== 'link' && (
        <div>
          <label className="block text-sm font-medium mb-1">Corner Radius</label>
          <select
            value={settings.buttonRadius ?? 'round'}
            onChange={(e) => onChange({ ...settings, buttonRadius: e.target.value as FeatureButtonsTileSettings['buttonRadius'] })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="sharp">Sharp</option>
            <option value="subtle">Subtle</option>
            <option value="round">Round</option>
            <option value="pill">Pill</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Button Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorInputValue(settings.buttonColor, '#0D6EFD')}
            onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.buttonColor ?? ''}
            onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
            placeholder="#0D6EFD"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Buttons are automatically generated based on enabled features (RSVP/Registry)
        </p>
      </div>

      {/* RSVP Button Label */}
      {hasRsvp && (
        <div>
          <label className="block text-sm font-medium mb-2">RSVP Button Label</label>
          <Input
            type="text"
            value={settings.rsvpLabel ?? ''}
            onChange={(e) => onChange({ ...settings, rsvpLabel: e.target.value })}
            placeholder="RSVP"
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Custom display name for the RSVP button
          </p>

          {eventId ? (
            <div className="mt-3">
              <a
                href={`/host/events/${eventId}/rsvp`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                <span>Configure RSVP Form</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <p className="text-xs text-gray-500 mt-1">
                Choose which fields guests see and map guest custom fields into the RSVP form.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Registry Button Label */}
      {hasRegistry && (
        <div>
          <label className="block text-sm font-medium mb-2">Registry Button Label</label>
          <Input
            type="text"
            value={settings.registryLabel ?? ''}
            onChange={(e) => onChange({ ...settings, registryLabel: e.target.value })}
            placeholder="Registry"
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Custom display name for the Registry button
          </p>
        </div>
      )}
    </div>
  )
}

