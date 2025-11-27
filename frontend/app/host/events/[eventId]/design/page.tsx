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
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'

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
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [rightPanelStyle, setRightPanelStyle] = useState<React.CSSProperties>({})
  const [spacerHeight, setSpacerHeight] = useState<number | null>(null)
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
      
      // Debug: Log API response to help diagnose staging issues
      logDebug('Event data loaded:', {
        eventId,
        hasPageConfig: !!eventData?.page_config,
        pageConfigKeys: eventData?.page_config ? Object.keys(eventData.page_config) : [],
        tilesCount: eventData?.page_config?.tiles?.length || 0,
      })
      
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
        logDebug('Page config loaded:', {
          hasPageConfig: !!pageConfig?.page_config,
          tilesCount: pageConfig?.page_config?.tiles?.length || 0,
        })
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

            // Ensure we have tiles and preserve all settings (especially coverPosition for image tiles)
            if (!preservedConfig.tiles || preservedConfig.tiles.length === 0) {
              finalConfig = {
                ...preservedConfig,
                tiles: createDefaultTiles(eventData),
              }
            } else {
              // Explicitly preserve all tile settings from loaded config
              // This ensures coverPosition and other settings are not lost
              finalConfig = {
                ...preservedConfig,
                tiles: preservedConfig.tiles.map(tile => {
                  // Find the corresponding tile in loadedConfig to preserve all settings
                  const loadedTile = loadedConfig.tiles?.find(lt => lt.id === tile.id)
                  if (loadedTile && loadedTile.settings) {
                    // Merge settings: loadedTile.settings takes precedence to preserve saved values like coverPosition
                    // Then apply any defaults from migrated tile
                    return {
                      ...tile,
                      settings: { ...tile.settings, ...loadedTile.settings }
                    }
                  }
                  return tile
                })
              }
              
              // Debug: Log image tile settings when loading
              const imageTile = finalConfig.tiles?.find(t => t.type === 'image')
              if (imageTile) {
                logDebug('Loaded config with image tile settings')
              }
            }

            // Select first enabled tile by default
            const firstEnabled = finalConfig.tiles?.find(t => t.enabled)
            if (firstEnabled) {
              setSelectedTileId(firstEnabled.id)
            }
          } catch (migrationError) {
            logError('Error during migration:', migrationError)
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
          logDebug('Final config before setting:', {
            tilesCount: finalConfig.tiles?.length || 0,
            tileTypes: finalConfig.tiles?.map(t => t.type) || [],
          })
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
          logDebug('Config set successfully:', {
            tilesCount: finalConfig.tiles?.length || 0,
            tileTypes: finalConfig.tiles?.map(t => t.type) || [],
          })
      } else {
        logError('Final config is null - this should not happen')
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
        logError('Failed to load data:', error)
        logError('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        })
        showToast(getErrorMessage(error), 'error')
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

  // Calculate right panel position for fixed positioning on desktop
  useEffect(() => {
    const updateRightPanelPosition = () => {
      if (rightPanelRef.current && gridContainerRef.current && window.innerWidth >= 1024) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          if (rightPanelRef.current) {
            const rightPanelRect = rightPanelRef.current.getBoundingClientRect()
            const height = rightPanelRef.current.offsetHeight
            
            setRightPanelStyle({
              position: 'fixed',
              top: `${headerHeight + 20}px`,
              left: `${rightPanelRect.left}px`,
              width: `${rightPanelRect.width}px`,
              maxHeight: `calc(100vh - ${headerHeight}px - 20px)`,
            })
            setSpacerHeight(height)
          }
        })
      } else {
        setRightPanelStyle({
          position: 'relative',
          top: 'auto',
          left: 'auto',
          width: 'auto',
          maxHeight: 'none',
        })
        setSpacerHeight(null)
      }
    }

    // Initial calculation with multiple attempts to ensure it works
    const timeoutId1 = setTimeout(updateRightPanelPosition, 50)
    const timeoutId2 = setTimeout(updateRightPanelPosition, 200)
    const timeoutId3 = setTimeout(updateRightPanelPosition, 500)
    
    // Update on resize and scroll
    window.addEventListener('resize', updateRightPanelPosition)
    window.addEventListener('scroll', updateRightPanelPosition, { passive: true })
    
    return () => {
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
      clearTimeout(timeoutId3)
      window.removeEventListener('resize', updateRightPanelPosition)
      window.removeEventListener('scroll', updateRightPanelPosition)
    }
  }, [event, headerHeight, config])

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
      // Also ensure all tile settings are preserved, including coverPosition
      const configToSave: InviteConfig = {
        ...config,
        // Ensure title tile is enabled in saved config
        // Also ensure all settings are preserved (including coverPosition for image tiles)
        tiles: config.tiles?.map(t => {
          if (t.type === 'title') {
            return { ...t, enabled: true }
          }
          // For image tiles, explicitly preserve all settings including coverPosition
          if (t.type === 'image') {
            const imageSettings = t.settings as any
            // Log to help debug position saving
            if (imageSettings.coverPosition) {
              logDebug('Saving image tile with coverPosition:', imageSettings.coverPosition)
            }
            return { ...t, settings: { ...imageSettings } }
          }
          return t
        }) || [],
      }
      
      // Explicitly ensure customColors is included if it has any properties
      if (config.customColors) {
        configToSave.customColors = config.customColors
      }
      
      // Debug: Log what we're saving
      const imageTile = configToSave.tiles?.find(t => t.type === 'image')
      if (imageTile) {
        logDebug('Saving config with image tile settings')
      }
      
      await updateEventPageConfig(eventId, configToSave)
      showToast('Invitation saved successfully!', 'success')
    } catch (error: any) {
      logError('Failed to save:', error)
      showToast(getErrorMessage(error), 'error')
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
    // Debug: Log tiles being rendered (will show in console if DEBUG mode, or can be checked in network tab)
    logDebug('Rendering tiles:', {
      count: sortedTiles.length,
      types: sortedTiles.map(t => t.type),
      enabled: sortedTiles.filter(t => t.enabled).map(t => t.type),
    })
  } else {
    logError('No tiles in config, using DEFAULT_TILES')
    sortedTiles = DEFAULT_TILES
  }

  return (
    <div className="min-h-screen bg-eco-beige w-full overflow-x-hidden">
        {/* Header */}
      <div ref={headerRef} className="bg-white border-b fixed top-0 left-0 right-0 z-50 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 w-full overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 w-full">
          <div className="flex-1 min-w-0 w-full">
            <Link href={`/host/events/${eventId}`}>
                <Button variant="outline" className="mb-2 text-xs sm:text-sm w-full sm:w-auto">
                ← Back to Event
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-eco-green break-words">Design Invitation Page</h1>
              <p className="text-gray-600 mt-1 text-xs sm:text-sm break-words">Customize your invitation page by arranging and configuring tiles. Drag tiles in the mobile preview to reorder them.</p>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto">
              <Link href={`/invite/${event?.slug}`} target="_blank" className="flex-1 sm:flex-none">
                <Button variant="outline" className="border-eco-green text-eco-green text-xs sm:text-sm px-3 sm:px-4 w-full sm:w-auto">
              👁️ <span className="hidden sm:inline">Preview</span>
            </Button>
              </Link>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-eco-green hover:bg-green-600 text-white text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none w-full sm:w-auto"
            >
              {saving ? 'Saving...' : <><span className="hidden sm:inline">💾 </span>Save</>}
            </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 w-full overflow-x-hidden" style={{ paddingTop: `${headerHeight}px`, paddingBottom: '1.5rem' }}>
        <div ref={gridContainerRef} className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 w-full items-start">
          {/* Left Panel - Settings */}
          <div className="lg:col-span-3 space-y-4 w-full min-w-0 pt-4 sm:pt-6">
            {/* Page Settings */}
            <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
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

            <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
              <h2 className="text-base sm:text-lg font-semibold text-eco-green mb-3 sm:mb-4">Tile Settings</h2>
              <div className="space-y-4 w-full">
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
          <>
            {/* Spacer to maintain grid layout when panel is fixed */}
            {rightPanelStyle.position === 'fixed' && spacerHeight !== null && (
              <div className="lg:col-span-2 w-full min-w-0" style={{ height: `${spacerHeight}px` }} />
            )}
            <div 
              ref={rightPanelRef}
              className="lg:col-span-2 w-full min-w-0 overflow-x-hidden"
              style={rightPanelStyle}
            >
            <div 
              className="lg:z-40 bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden"
              style={{ 
                maxHeight: `calc(100vh - ${headerHeight}px - 20px - 1rem)`,
                overflowY: 'auto'
              }}
            >
              <h2 className="text-base sm:text-lg font-semibold text-eco-green mb-2">Mobile Preview</h2>
              <p className="text-xs text-gray-600 mb-3 sm:mb-4">Customize your invitation by dragging tiles up and down to reorder them.</p>
              {/* iPhone 16 Frame - Responsive */}
              <div className="flex justify-center items-start w-full overflow-x-hidden">
                <div className="relative w-full flex justify-center" style={{ maxWidth: '100%' }}>
                  {/* iPhone 16 Frame - Black bezel with rounded corners */}
                  <div 
                    className="bg-black shadow-2xl mx-auto"
                    style={{ 
                      maxWidth: 'calc(100% - 16px)',
                      width: 'min(100%, 320px, 390px)',
                      borderRadius: 'clamp(1.5rem, 4vw, 3rem)',
                      padding: 'clamp(3px, 1vw, 6px)'
                    }}
                  >
                    {/* Screen Bezel */}
                    <div 
                      className="bg-black relative"
                      style={{ 
                        borderRadius: 'clamp(1.25rem, 3.5vw, 2.75rem)',
                        padding: 'clamp(1px, 0.5vw, 3px)'
                      }}
                    >
                      {/* Dynamic Island (iPhone 16) */}
                      <div 
                        className="absolute left-1/2 transform -translate-x-1/2 bg-black rounded-full z-20"
                        style={{ 
                          top: 'clamp(6px, 1.5vw, 12px)',
                          width: 'clamp(80px, 25vw, 126px)',
                          height: 'clamp(24px, 7.5vw, 37px)'
                        }}
                      ></div>
                      {/* Screen - iPhone 16 aspect ratio (1179:2556 ≈ 0.461) */}
                <div 
                        className="relative overflow-hidden bg-white flex flex-col w-full"
                  style={{ 
                          width: '100%',
                          aspectRatio: '1179 / 2556',
                    backgroundColor: config.customColors?.backgroundColor || '#ffffff',
                    borderRadius: 'clamp(1.25rem, 3vw, 2.5rem)'
                        }}
                      >
                        {/* Status Bar Area with Dynamic Island space */}
                        <div 
                          className="bg-transparent flex items-start justify-center flex-shrink-0"
                          style={{
                            height: 'clamp(30px, 8vw, 47px)',
                            paddingTop: 'clamp(4px, 1vw, 8px)'
                          }}
                        >
                          {/* Dynamic Island visual indicator */}
                          <div 
                            className="bg-black rounded-full opacity-30"
                            style={{
                              width: 'clamp(80px, 25vw, 126px)',
                              height: 'clamp(24px, 7.5vw, 37px)'
                            }}
                          ></div>
                        </div>
                        {/* Content Area */}
                        <div className="overflow-y-auto flex-1 w-full overflow-x-hidden" style={{ paddingBottom: '24px' }}>
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
                        <div 
                          className="absolute left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-full z-10"
                          style={{
                            bottom: 'clamp(4px, 1vw, 8px)',
                            width: 'clamp(90px, 28vw, 134px)',
                            height: 'clamp(3px, 0.8vw, 5px)'
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                Use the drag handle (⋮⋮) on each tile to reorder. Footer stays at the bottom.
                </p>
                </div>
            </div>
          </>
        </div>
      </div>
    </div>
  )
}