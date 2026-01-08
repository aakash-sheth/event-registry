'use client'

import React, { useState } from 'react'
import { EventCarouselTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

interface EventCarouselTileSettingsProps {
  settings: EventCarouselTileSettings
  onUpdate: (settings: EventCarouselTileSettings) => void
  eventId: number
}

export default function EventCarouselTileSettingsComponent({
  settings,
  onUpdate,
  eventId,
}: EventCarouselTileSettingsProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    slideshow: true,
    cardStyling: false,
    imageSettings: false,
    titleStyling: false,
    detailsStyling: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleShowFieldChange = (field: keyof EventCarouselTileSettings['showFields'], value: boolean) => {
    onUpdate({
      ...settings,
      showFields: {
        ...settings.showFields,
        [field]: value,
      },
    })
  }

  const handleUpdate = (updates: Partial<EventCarouselTileSettings>) => {
    onUpdate({
      ...settings,
      ...updates,
    })
  }

  const handleTitleStylingUpdate = (updates: Partial<EventCarouselTileSettings['subEventTitleStyling']>) => {
    onUpdate({
      ...settings,
      subEventTitleStyling: {
        ...settings.subEventTitleStyling,
        ...updates,
      },
    })
  }

  const handleDetailsStylingUpdate = (updates: Partial<EventCarouselTileSettings['subEventDetailsStyling']>) => {
    onUpdate({
      ...settings,
      subEventDetailsStyling: {
        ...settings.subEventDetailsStyling,
        ...updates,
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Sub-Event Management Link */}
      <div>
        <a
          href={`/host/events/${eventId}/sub-events`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <span>Manage Sub-Events</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Show Fields Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Show Fields
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.showFields?.image ?? true}
              onChange={(e) => handleShowFieldChange('image', e.target.checked)}
              className="mr-2"
            />
            Image
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.showFields?.title ?? true}
              onChange={(e) => handleShowFieldChange('title', e.target.checked)}
              className="mr-2"
            />
            Title
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.showFields?.dateTime ?? true}
              onChange={(e) => handleShowFieldChange('dateTime', e.target.checked)}
              className="mr-2"
            />
            Date & Time
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.showFields?.location ?? true}
              onChange={(e) => handleShowFieldChange('location', e.target.checked)}
              className="mr-2"
            />
            Location
          </label>
        </div>
      </div>

      {/* Sub-Event Title Styling Section */}
      <div className="border-t pt-4">
        <button
          onClick={() => toggleSection('titleStyling')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <label className="block text-sm font-medium text-gray-700">
            Sub-Event Title Styling
          </label>
          {expandedSections.titleStyling ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {expandedSections.titleStyling && (
          <div className="space-y-4 pl-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Event Title Font</label>
              <select
                value={FONT_OPTIONS.find(f => f.family === settings.subEventTitleStyling?.font)?.id || FONT_OPTIONS[0].id}
                onChange={(e) => {
                  const font = FONT_OPTIONS.find(f => f.id === e.target.value)
                  handleTitleStylingUpdate({ font: font?.family })
                }}
                className="w-full text-sm border rounded px-3 py-2"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name} ({font.category})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Preview: <span style={{ fontFamily: settings.subEventTitleStyling?.font || FONT_OPTIONS[0].family }}>Sub-Event Title</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Event Title Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.subEventTitleStyling?.color || '#111827'}
                  onChange={(e) => handleTitleStylingUpdate({ color: e.target.value })}
                  className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.subEventTitleStyling?.color || '#111827'}
                  onChange={(e) => handleTitleStylingUpdate({ color: e.target.value })}
                  placeholder="#111827"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Event Title Size</label>
              <select
                value={settings.subEventTitleStyling?.size || 'medium'}
                onChange={(e) => handleTitleStylingUpdate({ size: e.target.value as 'small' | 'medium' | 'large' | 'xlarge' })}
                className="w-full text-sm border rounded px-3 py-2"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Preview size: {settings.subEventTitleStyling?.size || 'medium'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Event Details Styling Section */}
      <div className="border-t pt-4">
        <button
          onClick={() => toggleSection('detailsStyling')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <label className="block text-sm font-medium text-gray-700">
            Sub-Event Details Styling
          </label>
          {expandedSections.detailsStyling ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {expandedSections.detailsStyling && (
          <div className="space-y-4 pl-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Event Details Font Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.subEventDetailsStyling?.fontColor || '#4B5563'}
                  onChange={(e) => handleDetailsStylingUpdate({ fontColor: e.target.value })}
                  className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.subEventDetailsStyling?.fontColor || '#4B5563'}
                  onChange={(e) => handleDetailsStylingUpdate({ fontColor: e.target.value })}
                  placeholder="#4B5563"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Color for sub-event date/time and location text
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Slideshow Section */}
      <div className="border-t pt-4">
        <button
          onClick={() => toggleSection('slideshow')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <label className="block text-sm font-medium text-gray-700">
            Slideshow Controls
          </label>
          {expandedSections.slideshow ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {expandedSections.slideshow && (
          <div className="space-y-4 pl-2">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoPlay !== false}
                  onChange={(e) => handleUpdate({ autoPlay: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Auto-play</span>
              </label>
            </div>
            {settings.autoPlay !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auto-play Interval: {settings.autoPlayInterval || 5000}ms
                </label>
                <input
                  type="range"
                  min="3000"
                  max="10000"
                  step="500"
                  value={settings.autoPlayInterval || 5000}
                  onChange={(e) => handleUpdate({ autoPlayInterval: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>3s</span>
                  <span>10s</span>
                </div>
              </div>
            )}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showArrows !== false}
                  onChange={(e) => handleUpdate({ showArrows: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Show Navigation Arrows</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showDots !== false}
                  onChange={(e) => handleUpdate({ showDots: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Show Dot Indicators</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Card Styling Section */}
      <div className="border-t pt-4">
        <button
          onClick={() => toggleSection('cardStyling')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <label className="block text-sm font-medium text-gray-700">
            Card Styling
          </label>
          {expandedSections.cardStyling ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {expandedSections.cardStyling && (
          <div className="space-y-4 pl-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Style Preset
              </label>
              <select
                value={settings.cardStyle || 'elegant'}
                onChange={(e) => handleUpdate({ cardStyle: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="minimal">Minimal</option>
                <option value="elegant">Elegant</option>
                <option value="modern">Modern</option>
                <option value="classic">Classic</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Layout
              </label>
              <select
                value={settings.cardLayout || 'centered'}
                onChange={(e) => handleUpdate({ cardLayout: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="full-width">Full Width</option>
                <option value="centered">Centered</option>
                <option value="grid">Grid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Spacing
              </label>
              <select
                value={settings.cardSpacing || 'normal'}
                onChange={(e) => handleUpdate({ cardSpacing: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="tight">Tight</option>
                <option value="normal">Normal</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Padding
              </label>
              <select
                value={settings.cardPadding || 'normal'}
                onChange={(e) => handleUpdate({ cardPadding: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="tight">Tight (16px)</option>
                <option value="normal">Normal (24px)</option>
                <option value="spacious">Spacious (32px)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.cardBackgroundColor || '#ffffff'}
                  onChange={(e) => handleUpdate({ cardBackgroundColor: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.cardBackgroundColor || '#ffffff'}
                  onChange={(e) => handleUpdate({ cardBackgroundColor: e.target.value })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Border Radius: {settings.cardBorderRadius ?? 12}px
              </label>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={settings.cardBorderRadius ?? 12}
                onChange={(e) => handleUpdate({ cardBorderRadius: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shadow
              </label>
              <select
                value={settings.cardShadow || 'md'}
                onChange={(e) => handleUpdate({ cardShadow: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="none">None</option>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
                <option value="xl">Extra Large</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Border Width: {settings.cardBorderWidth || 0}px
              </label>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={settings.cardBorderWidth || 0}
                onChange={(e) => handleUpdate({ cardBorderWidth: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            {settings.cardBorderWidth && settings.cardBorderWidth > 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Border Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.cardBorderColor || '#000000'}
                      onChange={(e) => handleUpdate({ cardBorderColor: e.target.value })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={settings.cardBorderColor || '#000000'}
                      onChange={(e) => handleUpdate({ cardBorderColor: e.target.value })}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Border Style
                  </label>
                  <select
                    value={settings.cardBorderStyle || 'solid'}
                    onChange={(e) => handleUpdate({ cardBorderStyle: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image Settings Section */}
      <div className="border-t pt-4">
        <button
          onClick={() => toggleSection('imageSettings')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <label className="block text-sm font-medium text-gray-700">
            Image Settings
          </label>
          {expandedSections.imageSettings ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {expandedSections.imageSettings && (
          <div className="space-y-4 pl-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image Height
              </label>
              <select
                value={settings.imageHeight || 'medium'}
                onChange={(e) => handleUpdate({ imageHeight: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="small">Small (192px)</option>
                <option value="medium">Medium (256px)</option>
                <option value="large">Large (384px)</option>
                <option value="full">Full (512px)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aspect Ratio
              </label>
              <select
                value={settings.imageAspectRatio || '16:9'}
                onChange={(e) => handleUpdate({ imageAspectRatio: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="4:3">4:3 (Standard)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="auto">Auto (Original)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
