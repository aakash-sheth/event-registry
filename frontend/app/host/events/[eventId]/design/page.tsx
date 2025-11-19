'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { InviteConfig, Tile } from '@/lib/invite/schema'
import { updateEventPageConfig, getEventPageConfig } from '@/lib/event/api'
import { migrateToTileConfig } from '@/lib/invite/migrateConfig'
import TileList from '@/components/invite/tiles/TileList'
import TileSettings from '@/components/invite/tiles/TileSettings'

interface Event {
  id: number
  slug: string
  title: string
  date?: string
  city?: string
  description?: string
  has_rsvp: boolean
  has_registry: boolean
}

const DEFAULT_TILES: Tile[] = [
  {
    id: 'tile-title-0',
    type: 'title',
    enabled: true,
    order: 0,
    settings: { text: 'Event Title' },
  },
  {
    id: 'tile-event-details-1',
    type: 'event-details',
    enabled: true,
    order: 1,
    settings: { location: '', date: new Date().toISOString().split('T')[0] },
  },
  {
    id: 'tile-feature-buttons-2',
    type: 'feature-buttons',
    enabled: true,
    order: 2,
    settings: { buttonColor: '#0D6EFD' },
  },
  {
    id: 'tile-footer-3',
    type: 'footer',
    enabled: false,
    order: 3,
    settings: { text: '' },
  },
]

export default function DesignInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId ? parseInt(params.eventId as string) : 0
  
  // Validate eventId
  if (!eventId || isNaN(eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <div className="text-center">
          <p className="text-red-500">Invalid event ID</p>
          <Link href="/host/dashboard">
            <Button className="mt-4">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }
  const { showToast } = useToast()
  
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [headerHeight, setHeaderHeight] = useState(160)
  const headerRef = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<InviteConfig>({
    themeId: 'classic-noir',
    tiles: DEFAULT_TILES,
  })

  useEffect(() => {
    const loadData = async () => {
    try {
        // First fetch event data
        const eventResponse = await api.get(`/api/events/${eventId}/`)
        const eventData = eventResponse.data
      setEvent(eventData)
      
        // Helper function to create default tiles
        const createDefaultTiles = (data: typeof eventData): Tile[] => [
          {
            id: 'tile-title-0',
            type: 'title',
            enabled: true,
            order: 0,
            settings: { text: data?.title || 'Event Title' },
          },
          {
            id: 'tile-event-details-1',
            type: 'event-details',
            enabled: true,
            order: 1,
            settings: {
              location: data?.city || '',
              date: data?.date || new Date().toISOString().split('T')[0],
            },
          },
          {
            id: 'tile-feature-buttons-2',
            type: 'feature-buttons',
            enabled: true,
            order: 2,
            settings: { buttonColor: '#0D6EFD' },
          },
          {
            id: 'tile-footer-3',
            type: 'footer',
            enabled: false,
            order: 3,
            settings: { text: '' },
          },
        ]
        
        // Then fetch page config (which may need event data for migration)
        const pageConfig = await getEventPageConfig(eventId)
        let finalConfig: InviteConfig | null = null
        
        if (pageConfig?.page_config) {
          try {
            const loadedConfig = pageConfig.page_config as InviteConfig
            
            // Migrate old config to tile-based if needed
            const migratedConfig = migrateToTileConfig(
              loadedConfig,
              eventData?.title,
              eventData?.date,
              eventData?.city
            )

            // Preserve customColors and customFonts from loaded config
            // IMPORTANT: Explicitly preserve customColors even if it's an empty object
            const preservedConfig = {
              ...migratedConfig,
              // Preserve customColors if it exists in loadedConfig, otherwise keep migratedConfig's customColors
              customColors: loadedConfig.customColors !== undefined 
                ? loadedConfig.customColors 
                : (migratedConfig.customColors || {}),
              customFonts: loadedConfig.customFonts !== undefined
                ? loadedConfig.customFonts
                : migratedConfig.customFonts,
            }

            // Ensure we have tiles
            if (!preservedConfig.tiles || preservedConfig.tiles.length === 0) {
              finalConfig = {
                ...preservedConfig,
                tiles: createDefaultTiles(eventData),
              }
            } else {
              finalConfig = preservedConfig
            }

            // Select first enabled tile by default
            const firstEnabled = finalConfig.tiles?.find(t => t.enabled)
            if (firstEnabled) {
              setSelectedTileId(firstEnabled.id)
            }
          } catch (migrationError) {
            console.error('Error during migration:', migrationError)
            // Fall through to initialize with default tiles
            finalConfig = null
          }
        }
        
        // If no config exists or migration failed, initialize with event data
        if (!finalConfig) {
          const defaultTiles = createDefaultTiles(eventData)
          finalConfig = { 
            themeId: 'classic-noir', 
            tiles: defaultTiles,
            customColors: {}, // Initialize empty customColors object
          }
          setSelectedTileId('tile-title-0')
        } else {
          // Ensure customColors exists in loaded config (initialize as empty object if missing)
          if (!finalConfig.customColors) {
            finalConfig.customColors = {}
          }
        }
        
        // Set the final config
        if (finalConfig) {
          // Ensure title tile always exists and is enabled
          if (!finalConfig.tiles || finalConfig.tiles.length === 0 || !finalConfig.tiles.some(t => t.type === 'title')) {
            // Add title tile if missing
            const titleTile: Tile = {
              id: 'tile-title-0',
              type: 'title',
              enabled: true,
              order: 0,
              settings: { text: eventData?.title || 'Event Title' },
            }
            finalConfig.tiles = [titleTile, ...(finalConfig.tiles || [])]
          } else {
            // Ensure title tile is always enabled
            finalConfig.tiles = finalConfig.tiles.map(t => 
              t.type === 'title' ? { ...t, enabled: true } : t
            )
          }
          
          setConfig(finalConfig)
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else {
          console.error('Failed to load data:', error)
        showToast('Failed to load event', 'error')
      }
    } finally {
      setLoading(false)
    }
  }
    
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // Measure header height for sticky positioning
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight
        setHeaderHeight(height + 16) // Add 16px for spacing
      }
    }

    updateHeaderHeight()
    window.addEventListener('resize', updateHeaderHeight)
    
    return () => {
      window.removeEventListener('resize', updateHeaderHeight)
    }
  }, [event])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Validate that title tile exists and has text
      const titleTile = config.tiles?.find(t => t.type === 'title')
      if (!titleTile) {
        showToast('Title tile is required. Please add a title tile.', 'error')
        setSaving(false)
        return
      }
      
      const titleText = (titleTile.settings as any)?.text?.trim()
      if (!titleText || titleText === '') {
        showToast('Title text is required. Please enter a title.', 'error')
        setSaving(false)
        return
      }
      
      // Ensure title tile is always enabled
      if (!titleTile.enabled) {
        showToast('Title tile must be enabled. Enabling it now.', 'info')
        setConfig(prev => ({
          ...prev,
          tiles: prev.tiles?.map(t => t.id === titleTile.id ? { ...t, enabled: true } : t) || [],
        }))
      }
      
      // Build config to save - ALWAYS include customColors if it exists
      const configToSave: InviteConfig = {
        ...config,
        // Ensure title tile is enabled in saved config
        tiles: config.tiles?.map(t => 
          t.type === 'title' ? { ...t, enabled: true } : t
        ) || [],
      }
      
      // Explicitly ensure customColors is included if it has any properties
      if (config.customColors) {
        configToSave.customColors = config.customColors
      }
      
      await updateEventPageConfig(eventId, configToSave)
      showToast('Invitation saved successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to save:', error)
      showToast(error.response?.data?.error || 'Failed to save invitation', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTileUpdate = (updatedTile: Tile) => {
    setConfig(prev => ({
      ...prev,
      tiles: prev.tiles?.map(t => t.id === updatedTile.id ? updatedTile : t) || [],
    }))
  }

  const handleTileToggle = (tileId: string, enabled: boolean) => {
    // Prevent disabling the title tile (it's mandatory)
    const tile = config.tiles?.find(t => t.id === tileId)
    if (tile?.type === 'title' && !enabled) {
      showToast('Title tile cannot be disabled. It is required.', 'error')
      return
    }
    
    setConfig(prev => ({
      ...prev,
      tiles: prev.tiles?.map(t => t.id === tileId ? { ...t, enabled } : t) || [],
    }))
  }

  const handleTileReorder = (reorderedTiles: Tile[]) => {
    setConfig(prev => ({
      ...prev,
      tiles: reorderedTiles,
    }))
  }

  const handleTileSelect = (tileId: string) => {
    setSelectedTileId(tileId)
  }

  const handleOverlayToggle = (tileId: string, targetTileId: string | undefined) => {
    setConfig(prev => ({
      ...prev,
      tiles: prev.tiles?.map(t => {
        if (t.id === tileId) {
          return {
            ...t,
            overlayTargetId: targetTileId,
            settings: {
              ...t.settings,
              overlayMode: !!targetTileId,
              overlayPosition: targetTileId ? ((t.settings as any).overlayPosition || { x: 50, y: 50 }) : undefined,
            },
          }
        }
        return t
      }) || [],
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Ensure we have valid tiles before rendering
  if (!config.tiles || config.tiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <p className="text-gray-600">Loading tiles...</p>
        </div>
      </div>
    )
  }

  const selectedTile = config.tiles?.find(t => t.id === selectedTileId)
  let sortedTiles: Tile[]
  if (config.tiles && config.tiles.length > 0) {
    sortedTiles = [...config.tiles].sort((a, b) => a.order - b.order)
  } else {
    sortedTiles = DEFAULT_TILES
  }

  return (
    <div className="min-h-screen bg-eco-beige">
        {/* Header */}
      <div ref={headerRef} className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
          <div>
            <Link href={`/host/events/${eventId}`}>
                <Button variant="outline" className="mb-2">
                ← Back to Event
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-eco-green">Design Invitation Page</h1>
              <p className="text-gray-600 mt-1">Customize your invitation using draggable tiles</p>
          </div>
          <div className="flex gap-3">
              <Link href={`/invite/${event?.slug}`} target="_blank">
                <Button variant="outline" className="border-eco-green text-eco-green">
              👁️ Preview
            </Button>
              </Link>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-eco-green hover:bg-green-600 text-white"
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </Button>
            </div>
          </div>
          </div>
        </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Settings */}
          <div className="lg:col-span-3 space-y-4">
            {/* Page Settings */}
            <div className="bg-white rounded-lg border-2 border-eco-green-light p-4">
              <h2 className="text-lg font-semibold text-eco-green mb-4">Page Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Page Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.customColors?.backgroundColor || '#ffffff'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        customColors: {
                          ...prev.customColors,
                          backgroundColor: e.target.value,
                        },
                      }))}
                      className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={config.customColors?.backgroundColor || '#ffffff'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        customColors: {
                          ...prev.customColors,
                          backgroundColor: e.target.value,
                        },
                      }))}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Background color for the entire invitation page
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border-2 border-eco-green-light p-4">
              <h2 className="text-lg font-semibold text-eco-green mb-4">Tile Settings</h2>
              <div className="space-y-4">
                {sortedTiles && sortedTiles.length > 0 ? (
                  sortedTiles.map((tile) => (
                    <TileSettings
                      key={tile.id}
                      tile={tile}
                      onUpdate={handleTileUpdate}
                      onToggle={handleTileToggle}
                      allTiles={sortedTiles}
                      onOverlayToggle={handleOverlayToggle}
                    />
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No tiles available</p>
                )}
                    </div>
                  </div>
                </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2">
            <div 
              className="lg:sticky lg:self-start lg:z-40 bg-white rounded-lg border-2 border-eco-green-light p-4"
              style={{ top: `${headerHeight}px` }}
            >
              <h2 className="text-lg font-semibold text-eco-green mb-4">Mobile Preview</h2>
              {/* iPhone 16 Frame - 1:1 Proportion */}
              <div className="flex justify-center items-start">
                <div className="relative">
                  {/* iPhone 16 Frame - Black bezel with rounded corners */}
                  <div className="bg-black rounded-[3rem] p-[6px] shadow-2xl mx-auto">
                    {/* Screen Bezel */}
                    <div className="bg-black rounded-[2.75rem] p-[3px] relative">
                      {/* Dynamic Island (iPhone 16) */}
                      <div className="absolute top-[12px] left-1/2 transform -translate-x-1/2 w-[126px] h-[37px] bg-black rounded-full z-20"></div>
                      {/* Screen - iPhone 16 aspect ratio (1179:2556 ≈ 0.461) */}
                <div 
                        className="relative rounded-[2.5rem] overflow-hidden bg-white flex flex-col"
                  style={{ 
                          width: '390px',
                          height: '844px',
                          aspectRatio: '1179 / 2556',
                    backgroundColor: config.customColors?.backgroundColor || '#ffffff',
                        }}
                      >
                        {/* Status Bar Area with Dynamic Island space */}
                        <div className="h-[47px] bg-transparent flex items-start justify-center flex-shrink-0 pt-[8px]">
                          {/* Dynamic Island visual indicator */}
                          <div className="w-[126px] h-[37px] bg-black rounded-full opacity-30"></div>
                        </div>
                        {/* Content Area */}
                        <div className="overflow-y-auto flex-1" style={{ paddingBottom: '34px' }}>
                    {sortedTiles && sortedTiles.length > 0 ? (
                      <TileList
                        tiles={sortedTiles}
                        onReorder={handleTileReorder}
                        eventDate={event?.date}
                        eventSlug={event?.slug}
                              eventTitle={(sortedTiles.find(t => t.type === 'title')?.settings as { text?: string })?.text || event?.title || 'Event'}
                        hasRsvp={event?.has_rsvp}
                        hasRegistry={event?.has_registry}
                      />
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <p>Loading tiles...</p>
                      </div>
                    )}
                        </div>
                        {/* Home Indicator (iPhone 16) */}
                        <div className="absolute bottom-[8px] left-1/2 transform -translate-x-1/2 w-[134px] h-[5px] bg-gray-800 rounded-full z-10"></div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                Drag tiles to reorder. Footer stays at the bottom.
                </p>
                </div>
          </div>
        </div>
      </div>
    </div>
  )
}