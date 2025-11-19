'use client'

import React from 'react'
import { TimerTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'

interface TimerTileSettingsProps {
  settings: TimerTileSettings
  onChange: (settings: TimerTileSettings) => void
}

export default function TimerTileSettings({ settings, onChange }: TimerTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Circle Color</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="circle-transparent"
                name="circleColor"
                checked={settings.circleColor === 'transparent'}
                onChange={() => onChange({ ...settings, circleColor: 'transparent' })}
                className="w-4 h-4 text-eco-green"
              />
              <label htmlFor="circle-transparent" className="text-sm cursor-pointer">Transparent (no background)</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="circle-custom"
                name="circleColor"
                checked={!settings.circleColor || (settings.circleColor && settings.circleColor !== 'transparent')}
                onChange={() => onChange({ ...settings, circleColor: settings.circleColor && settings.circleColor !== 'transparent' ? settings.circleColor : '#E55A9E' })}
                className="w-4 h-4 text-eco-green"
              />
              <label htmlFor="circle-custom" className="text-sm cursor-pointer">Circle Color</label>
              <input
                type="color"
                value={settings.circleColor && settings.circleColor !== 'transparent' ? settings.circleColor : '#E55A9E'}
                onChange={(e) => onChange({ ...settings, circleColor: e.target.value })}
                className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer ml-2"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        <p className="text-xs text-gray-500 mt-1">
          Transparent shows only text with border. Custom color fills the circle.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.textColor || (settings.circleColor === 'transparent' ? '#000000' : '#ffffff')}
            onChange={(e) => onChange({ ...settings, textColor: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.textColor || (settings.circleColor === 'transparent' ? '#000000' : '#ffffff')}
            onChange={(e) => onChange({ ...settings, textColor: e.target.value })}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Color for the numbers and labels in the timer circles
        </p>
      </div>
    </div>
  )
}

