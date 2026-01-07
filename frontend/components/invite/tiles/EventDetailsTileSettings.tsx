'use client'

import React, { useState } from 'react'
import type { EventDetailsTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'
import { 
  isValidMapUrl, 
  generateMapUrlFromLocation, 
  generateMapUrlFromCoordinates,
  canShowMap,
  validateAndVerifyMapLocation,
  isUrl,
  isValidCoordinates
} from '@/lib/invite/mapUtils'
import { Map, ExternalLink, Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react'

interface EventDetailsTileSettingsProps {
  settings: EventDetailsTileSettings
  onChange: (settings: EventDetailsTileSettings) => void
}

export default function EventDetailsTileSettings({ settings, onChange }: EventDetailsTileSettingsProps) {
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [showBorderStyling, setShowBorderStyling] = useState(false)
  
  const hasValidMapUrl = settings.mapUrl && isValidMapUrl(settings.mapUrl)
  const isLocationVerified = settings.locationVerified === true
  const canDisplayMap = canShowMap(settings)
  
  const handleLocationChange = (newLocation: string) => {
    // Location is just for display - no auto-generation
    onChange({ ...settings, location: newLocation })
  }
  
  const handleMapLocationChange = (newMapLocation: string) => {
    const locationValue = newMapLocation || undefined
    // Update mapUrl - it can be address text or URL
    const updatedSettings = { ...settings, mapUrl: locationValue }
    // Auto-validate and verify
    const validated = validateAndVerifyMapLocation(updatedSettings)
    onChange(validated)
  }
  
  const handleCoordinatesChange = (field: 'lat' | 'lng', value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || value === '') {
      // Clear coordinates if invalid or empty
      const updatedSettings = { ...settings, coordinates: undefined }
      const validated = validateAndVerifyMapLocation(updatedSettings)
      onChange(validated)
      return
    }
    
    const newCoordinates = {
      ...settings.coordinates,
      [field]: numValue
    } as { lat: number, lng: number }
    
    // Ensure both lat and lng are present
    if (field === 'lat' && settings.coordinates?.lng !== undefined) {
      newCoordinates.lng = settings.coordinates.lng
    } else if (field === 'lng' && settings.coordinates?.lat !== undefined) {
      newCoordinates.lat = settings.coordinates.lat
    }
    
    // Update coordinates and auto-validate
    const updatedSettings = { ...settings, coordinates: newCoordinates as any }
    const validated = validateAndVerifyMapLocation(updatedSettings)
    onChange(validated)
  }
  
  const handleGetCoordinatesFromMap = () => {
    // Open Google Maps with instructions
    const instructions = `To get coordinates:
1. Find your location on the map
2. Right-click on the location
3. Click the coordinates at the top of the menu
4. Copy the latitude and longitude
5. Paste them in the fields below`
    
    const searchUrl = settings.mapUrl || 'https://www.google.com/maps'
    window.open(searchUrl, '_blank', 'noopener,noreferrer')
    alert(instructions)
  }
  
  const handleOpenInMaps = () => {
    const searchUrl = settings.mapUrl || 'https://www.google.com/maps'
    window.open(searchUrl, '_blank', 'noopener,noreferrer')
  }

  // Determine if mapUrl is a URL or address text
  const mapLocationIsUrl = settings.mapUrl ? isUrl(settings.mapUrl) : false
  const mapLocationDisplay = settings.mapUrl || ''

  return (
    <div className="space-y-4">
      {/* Date and Time - Core event information */}
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

      {/* Location Input - Display text only */}
      <div>
        <label className="block text-sm font-medium mb-2">Location *</label>
        <Input
          value={settings.location || ''}
          onChange={(e) => handleLocationChange(e.target.value)}
          placeholder="e.g., Grand Ballroom, Main Hall, Beachside Venue"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter the display name for your event location (this appears on your invitation)
        </p>
      </div>

      {/* Map Location - Combined field for address or URL */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Map Location (Optional)</label>
          {isLocationVerified && settings.mapUrl && (
            <button
              type="button"
              onClick={handleOpenInMaps}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open in Maps
            </button>
          )}
        </div>
        <Input
          type="text"
          value={mapLocationDisplay}
          onChange={(e) => handleMapLocationChange(e.target.value)}
          placeholder="Enter address, paste Google Maps URL, or paste iframe embed code"
          className="w-full"
        />
        <div className="mt-2 space-y-1">
          {isLocationVerified && settings.mapUrl ? (
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 className="w-3 h-3" />
              <span>✓ Location verified. Maps can be displayed.</span>
            </div>
          ) : settings.mapUrl ? (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="w-3 h-3" />
              <span>⚠️ Invalid map location format. Please enter a valid address or Google Maps URL.</span>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Enter an address, paste a Google Maps URL, or paste iframe embed code. The system will automatically extract and verify the location.
            </p>
          )}
        </div>
      </div>

      {/* Coordinates Section - Collapsible */}
      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setShowCoordinates(!showCoordinates)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Use precise coordinates (optional)
            </span>
          </div>
          {showCoordinates ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        
        {showCoordinates && (
          <div className="p-4 pt-0 space-y-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-2">
              Enter coordinates for more accurate map placement. This will automatically verify your location.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Latitude</label>
                <Input
                  type="number"
                  step="any"
                  value={settings.coordinates?.lat ?? ''}
                  onChange={(e) => handleCoordinatesChange('lat', e.target.value)}
                  placeholder="e.g., 19.0760"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700">Longitude</label>
                <Input
                  type="number"
                  step="any"
                  value={settings.coordinates?.lng ?? ''}
                  onChange={(e) => handleCoordinatesChange('lng', e.target.value)}
                  placeholder="e.g., 72.8777"
                  className="w-full"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleGetCoordinatesFromMap}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 underline"
            >
              <ExternalLink className="w-3 h-3" />
              Get coordinates from Google Maps
            </button>
            {settings.coordinates && isValidCoordinates(settings.coordinates) && (
              <div className="flex items-center gap-2 text-xs text-green-700 mt-2">
                <CheckCircle2 className="w-3 h-3" />
                <span>✓ Valid coordinates. Location automatically verified.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Embedded Map Toggle - Disabled until verified */}
      <div className={`p-4 rounded-lg border ${isLocationVerified && hasValidMapUrl ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'}`}>
        <label className="flex items-start cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showMap || false}
            disabled={!canDisplayMap || !hasValidMapUrl}
            onChange={(e) => onChange({ 
              ...settings, 
              showMap: e.target.checked 
            })}
            className="mt-0.5 mr-3 w-4 h-4"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Display embedded map on invitation
              </span>
            </div>
            {!isLocationVerified ? (
              <p className="text-xs text-gray-500 mt-1.5">
                Please provide a valid map location above to enable this option
              </p>
            ) : !hasValidMapUrl ? (
              <p className="text-xs text-gray-500 mt-1.5">
                Map location format is invalid. Please check your address or URL.
              </p>
            ) : (() => {
              // Check if it's a short link
              const isShortLink = settings.mapUrl && (
                settings.mapUrl.includes('maps.app.goo.gl') || 
                settings.mapUrl.includes('goo.gl')
              )
              
              if (isShortLink && settings.showMap) {
                return (
                  <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <p className="text-xs text-amber-700">
                      <strong>Note:</strong> Short links (goo.gl) cannot be embedded directly. 
                      The map icon will still appear, but for embedded maps, please use a full Google Maps URL or coordinates.
                    </p>
                  </div>
                )
              }
              
              if (settings.showMap) {
                return (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-300">
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>📍 Map placement:</strong> The map will appear below the location text on your invitation, like this:
                    </p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        <span>Location: [Your location text]</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        <span className="italic">[Embedded map will appear here]</span>
                      </div>
                    </div>
                  </div>
                )
              }
              
              return (
                <p className="text-xs text-gray-500 mt-1.5">
                  Only the map icon link will appear next to the location text
                </p>
              )
            })()}
          </div>
        </label>
        
      </div>

      {/* Additional Details */}
      <div>
        <label className="block text-sm font-medium mb-2">Dress Code (optional)</label>
        <Input
          value={settings.dressCode || ''}
          onChange={(e) => onChange({ ...settings, dressCode: e.target.value || undefined })}
          placeholder="e.g., Formal, Casual, Traditional"
        />
      </div>

      {/* Styling Options */}
      <div>
        <label className="block text-sm font-medium mb-2">Font Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.fontColor || '#1F2937'}
            onChange={(e) => onChange({ ...settings, fontColor: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.fontColor || '#1F2937'}
            onChange={(e) => onChange({ ...settings, fontColor: e.target.value })}
            placeholder="#1F2937"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Color for the event details text (date, time, location, dress code)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Button Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.buttonColor || '#1F2937'}
            onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.buttonColor || '#1F2937'}
            onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
            placeholder="#1F2937"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Color for the "Save the Date" button border and text. Text color will automatically adjust for contrast.
        </p>
      </div>

      {/* Border Styling Options */}
      <div className="border-t pt-4 mt-4">
        <button
          type="button"
          onClick={() => setShowBorderStyling(!showBorderStyling)}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h3 className="text-sm font-semibold text-gray-700">Border Styling</h3>
          {showBorderStyling ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        
        {showBorderStyling && (
          <div>
        
        {/* Border Style Preset */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Border Style</label>
          <div className="grid grid-cols-2 gap-2">
            {(['elegant', 'minimal', 'ornate', 'modern', 'classic', 'vintage', 'none'] as const).map((style) => {
              const isSelected = (settings.borderStyle || 'elegant') === style
              const borderConfig = {
                elegant: { symbol: '❦', lineStyle: 'gradient' },
                minimal: { symbol: '', lineStyle: 'solid' },
                ornate: { symbol: '✿', lineStyle: 'gradient' },
                modern: { symbol: '•', lineStyle: 'dotted' },
                classic: { symbol: '', lineStyle: 'double' },
                vintage: { symbol: '✦', lineStyle: 'gradient' },
                none: { symbol: '', lineStyle: 'none' },
              }[style]
              
              const previewColor = '#D1D5DB'
              
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ ...settings, borderStyle: style })}
                  className={`p-3 border-2 rounded-md text-left transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-xs font-medium mb-2 capitalize">{style}</div>
                  {style === 'none' ? (
                    <div className="h-8 flex items-center justify-center text-gray-400 text-xs">
                      No border
                    </div>
                  ) : (
                    <div className="h-8 flex items-center justify-center">
                      {borderConfig.lineStyle === 'gradient' ? (
                        <>
                          <div 
                            className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
                            style={{ color: previewColor, height: '1px' }}
                          />
                          {borderConfig.symbol && (
                            <div className="mx-2 text-sm" style={{ color: previewColor }}>
                              {borderConfig.symbol}
                            </div>
                          )}
                          <div 
                            className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
                            style={{ color: previewColor, height: '1px' }}
                          />
                        </>
                      ) : borderConfig.lineStyle === 'solid' ? (
                        <div 
                          className="w-full h-px"
                          style={{ borderTop: '1px solid', borderColor: previewColor }}
                        />
                      ) : borderConfig.lineStyle === 'dotted' ? (
                        <>
                          <div 
                            className="flex-1 h-px border-t border-dotted"
                            style={{ borderColor: previewColor, borderTopWidth: '1px' }}
                          />
                          {borderConfig.symbol && (
                            <div className="mx-2 text-sm" style={{ color: previewColor }}>
                              {borderConfig.symbol}
                            </div>
                          )}
                          <div 
                            className="flex-1 h-px border-t border-dotted"
                            style={{ borderColor: previewColor, borderTopWidth: '1px' }}
                          />
                        </>
                      ) : borderConfig.lineStyle === 'double' ? (
                        <div 
                          className="w-full h-px"
                          style={{ borderTop: '1px double', borderColor: previewColor }}
                        />
                      ) : null}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click a border style to preview and select
          </p>
        </div>
        
        {/* Only show border customization if borderStyle is not 'none' */}
        {settings.borderStyle !== 'none' && (
          <>
            {/* Border Color */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Border Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.borderColor || '#D1D5DB'}
                  onChange={(e) => onChange({ ...settings, borderColor: e.target.value })}
                  className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.borderColor || '#D1D5DB'}
                  onChange={(e) => onChange({ ...settings, borderColor: e.target.value })}
                  placeholder="#D1D5DB"
                  className="flex-1"
                />
              </div>
            </div>
            
            {/* Border Width */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Border Width: {settings.borderWidth || 1}px
              </label>
              <input
                type="range"
                min="1"
                max="4"
                value={settings.borderWidth || 1}
                onChange={(e) => onChange({ 
                  ...settings, 
                  borderWidth: parseInt(e.target.value) 
                })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Adjust border thickness (1-4 pixels)
              </p>
            </div>
            
            {/* Decorative Symbol (only for styles that support it) */}
            {(settings.borderStyle === 'elegant' || 
              settings.borderStyle === 'ornate' || 
              settings.borderStyle === 'modern' || 
              settings.borderStyle === 'vintage') && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Decorative Symbol</label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, decorativeSymbol: '❦' })}
                    className={`px-3 py-2 border rounded text-lg ${
                      settings.decorativeSymbol === '❦' ? 'bg-gray-100' : ''
                    }`}
                  >
                    ❦
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, decorativeSymbol: '✿' })}
                    className={`px-3 py-2 border rounded text-lg ${
                      settings.decorativeSymbol === '✿' ? 'bg-gray-100' : ''
                    }`}
                  >
                    ✿
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, decorativeSymbol: '✦' })}
                    className={`px-3 py-2 border rounded text-lg ${
                      settings.decorativeSymbol === '✦' ? 'bg-gray-100' : ''
                    }`}
                  >
                    ✦
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, decorativeSymbol: '•' })}
                    className={`px-3 py-2 border rounded text-lg ${
                      settings.decorativeSymbol === '•' ? 'bg-gray-100' : ''
                    }`}
                  >
                    •
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, decorativeSymbol: '' })}
                    className={`px-3 py-2 border rounded text-sm ${
                      !settings.decorativeSymbol ? 'bg-gray-100' : ''
                    }`}
                  >
                    None
                  </button>
                </div>
                <Input
                  type="text"
                  value={settings.decorativeSymbol || ''}
                  onChange={(e) => onChange({ ...settings, decorativeSymbol: e.target.value })}
                  placeholder="Custom symbol (optional)"
                  className="w-full"
                  maxLength={1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Custom decorative symbol (leave empty to use style default)
                </p>
              </div>
            )}
          </>
        )}
        
        {/* Background Color */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Background Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.backgroundColor || '#FFFFFF'}
              onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
              className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
            />
            <Input
              type="text"
              value={settings.backgroundColor || ''}
              onChange={(e) => onChange({ 
                ...settings, 
                backgroundColor: e.target.value || undefined 
              })}
              placeholder="Transparent (leave empty)"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Background color for the event details tile (leave empty for transparent)
          </p>
        </div>
        
        {/* Border Radius */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Border Radius: {settings.borderRadius ?? 0}px
          </label>
          <input
            type="range"
            min="0"
            max="24"
            value={settings.borderRadius ?? 0}
            onChange={(e) => onChange({ 
              ...settings, 
              borderRadius: parseInt(e.target.value) 
            })}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Rounded corners (0 = sharp corners, 24 = very rounded)
          </p>
        </div>
          </div>
        )}
      </div>
    </div>
  )
}
