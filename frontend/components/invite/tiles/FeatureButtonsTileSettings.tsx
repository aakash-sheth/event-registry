'use client'

import React from 'react'
import type { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'

interface FeatureButtonsTileSettingsProps {
  settings: FeatureButtonsTileSettings
  onChange: (settings: FeatureButtonsTileSettings) => void
}

export default function FeatureButtonsTileSettings({ settings, onChange }: FeatureButtonsTileSettingsProps) {
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
    </div>
  )
}

