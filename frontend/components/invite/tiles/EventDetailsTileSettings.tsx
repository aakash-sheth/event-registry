'use client'

import React from 'react'
import type { EventDetailsTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'

interface EventDetailsTileSettingsProps {
  settings: EventDetailsTileSettings
  onChange: (settings: EventDetailsTileSettings) => void
}

export default function EventDetailsTileSettings({ settings, onChange }: EventDetailsTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Location *</label>
        <Input
          value={settings.location || ''}
          onChange={(e) => onChange({ ...settings, location: e.target.value })}
          placeholder="Event location"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Date *</label>
        <Input
          type="date"
          value={settings.date || ''}
          onChange={(e) => onChange({ ...settings, date: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Time</label>
        <Input
          type="time"
          value={settings.time || ''}
          onChange={(e) => onChange({ ...settings, time: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Dress Code (optional)</label>
        <Input
          value={settings.dressCode || ''}
          onChange={(e) => onChange({ ...settings, dressCode: e.target.value || undefined })}
          placeholder="e.g., Formal, Casual, Traditional"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Map URL (Optional)</label>
        <Input
          type="url"
          value={settings.mapUrl || ''}
          onChange={(e) => onChange({ ...settings, mapUrl: e.target.value || undefined })}
          placeholder="https://maps.google.com/... or maps.apple.com/..."
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Add a map link (Google Maps, Apple Maps, etc.) to show a map icon next to the location. Leave empty to hide the icon.
        </p>
      </div>
    </div>
  )
}

