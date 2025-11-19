'use client'

import React from 'react'
import { DescriptionTileSettings } from '@/lib/invite/schema'
import RichTextEditor from '@/components/invite/RichTextEditor'

interface DescriptionTileSettingsProps {
  settings: DescriptionTileSettings
  onChange: (settings: DescriptionTileSettings) => void
}

export default function DescriptionTileSettings({ settings, onChange }: DescriptionTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <RichTextEditor
          value={settings.content || ''}
          onChange={(value) => onChange({ ...settings, content: value })}
          placeholder="Enter event description..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Use the toolbar to format text, add links, and insert emojis
        </p>
      </div>
    </div>
  )
}

