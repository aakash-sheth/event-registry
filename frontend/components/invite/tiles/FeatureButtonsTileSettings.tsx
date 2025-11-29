'use client'

import React from 'react'
import type { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'

interface FeatureButtonsTileSettingsProps {
  settings: FeatureButtonsTileSettings
  onChange: (settings: FeatureButtonsTileSettings) => void
  hasRsvp?: boolean
  hasRegistry?: boolean
}

export default function FeatureButtonsTileSettings({ 
  settings, 
  onChange, 
  hasRsvp = false, 
  hasRegistry = false 
}: FeatureButtonsTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Button Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.buttonColor || '#0D6EFD'}
            onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.buttonColor || '#0D6EFD'}
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
            value={settings.rsvpLabel || 'RSVP'}
            onChange={(e) => onChange({ ...settings, rsvpLabel: e.target.value })}
            placeholder="RSVP"
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Custom display name for the RSVP button
          </p>
        </div>
      )}

      {/* Registry Button Label */}
      {hasRegistry && (
        <div>
          <label className="block text-sm font-medium mb-2">Registry Button Label</label>
          <Input
            type="text"
            value={settings.registryLabel || 'Registry'}
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

