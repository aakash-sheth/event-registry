'use client'

import React from 'react'
import type { FooterTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'

interface FooterTileSettingsProps {
  settings: FooterTileSettings
  onChange: (settings: FooterTileSettings) => void
}

export default function FooterTileSettings({ settings, onChange }: FooterTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Footer Text</label>
        <textarea
          value={settings.text || ''}
          onChange={(e) => onChange({ ...settings, text: e.target.value })}
          placeholder="Please save the contact below. For any queries feel free to reach out to us!"
          className="w-full text-sm border rounded px-3 py-2 min-h-[100px]"
        />
        <p className="text-xs text-gray-500 mt-1">
          Footer will be hidden if left empty
        </p>
      </div>
    </div>
  )
}

