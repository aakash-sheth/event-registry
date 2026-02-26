'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import PublishModal from '@/components/invite/PublishModal'
import ImageCropModal from '@/components/invite/ImageCropModal'
import api, { uploadImage } from '@/lib/api'
import { InviteConfig, Tile, InvitePage } from '@/lib/invite/schema'
import { InvitePageState, getInvitePageState } from '@/lib/invite/types'
import { updateEventPageConfig, getEventPageConfig } from '@/lib/event/api'
import { getInvitePage, createInvitePage, publishInvitePage, getPublicInvite } from '@/lib/invite/api'
import { migrateToTileConfig } from '@/lib/invite/migrateConfig'
import TileList from '@/components/invite/tiles/TileList'
import TileSettingsList from '@/components/invite/tiles/TileSettingsList'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import { cropImage } from '@/lib/invite/imageAnalysis'

interface Event {
  id: number
  slug: string
  title: string
  date?: string
  city?: string
  description?: string
  banner_image?: string
  has_rsvp: boolean
  has_registry: boolean
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  custom_fields_metadata?: Record<string, any>
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
    id: 'tile-image-1',
    type: 'image',
    enabled: false,
    order: 1,
    settings: { src: '', fitMode: 'fit-to-screen' },
  },
  {
    id: 'tile-event-details-2',
    type: 'event-details',
    enabled: true,
    order: 2,
    settings: { location: '', date: new Date().toISOString().split('T')[0] },
  },
  {
    id: 'tile-description-3',
    type: 'description',
    enabled: false,
    order: 3,
    settings: { content: '' },
  },
  {
    id: 'tile-timer-4',
    type: 'timer',
    enabled: false,
    order: 4,
    settings: { enabled: true, format: 'circle', circleColor: '#0D6EFD', textColor: '#000000' },
  },
  {
    id: 'tile-feature-buttons-5',
    type: 'feature-buttons',
    enabled: true,
    order: 5,
    settings: { buttonColor: '#0D6EFD' },
  },
  {
    id: 'tile-event-carousel-7',
    type: 'event-carousel',
    enabled: false,
    order: 7,
    settings: {
      showFields: {
        image: true,
        title: true,
        dateTime: true,
        location: true,
        cta: true,
      },
    },
  },
  {
    id: 'tile-footer-8',
    type: 'footer',
    enabled: false,
    order: 8,
    settings: { text: '' },
  },
]

export default function DesignInvitationPage(): JSX.Element {
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
  const [allowedSubEvents, setAllowedSubEvents] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [headerHeight, setHeaderHeight] = useState(160)
  const headerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const previewImageInputRef = useRef<HTMLInputElement>(null)
  const previewWindowRef = useRef<Window | null>(null)
  const [rightPanelStyle, setRightPanelStyle] = useState<React.CSSProperties>({})
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showLinkMetadata, setShowLinkMetadata] = useState(false)
  const [uploadingPreviewImage, setUploadingPreviewImage] = useState(false)
  const [isPreviewCropOpen, setIsPreviewCropOpen] = useState(false)
  const [previewCropSrc, setPreviewCropSrc] = useState<string | null>(null)
  const [previewCropDimensions, setPreviewCropDimensions] = useState<{ width: number; height: number; aspectRatio: number } | null>(null)
  const [previewCropFilename, setPreviewCropFilename] = useState<string>('preview.jpg')
  const [spacerHeight, setSpacerHeight] = useState<number | null>(null)
  const [allTilesExpanded, setAllTilesExpanded] = useState(false)
  const [config, setConfig] = useState<InviteConfig>({
    themeId: 'classic-noir',
    tiles: DEFAULT_TILES,
  })
  // Preview order state - tracks real-time order for mobile preview (not saved to backend)
  const [previewOrder, setPreviewOrder] = useState<Map<string, number>>(new Map())
  // Fix 2: Add state for InvitePage and publish modal
  const [invitePage, setInvitePage] = useState<InvitePage | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        // First fetch event data
        const eventResponse = await api.get(`/api/events/${eventId}/`)
        const eventData = eventResponse.data
        setEvent(eventData)
      
      // Always fetch sub-events (regardless of event_structure) for Event Carousel tile
      try {
        const subEventsResponse = await api.get(`/api/events/envelopes/${eventId}/sub-events/`)
        const subEvents = subEventsResponse.data.results || subEventsResponse.data || []
        setAllowedSubEvents(subEvents)
      } catch (error: any) {
        // Event might not be ENVELOPE or might not have sub-events yet
        if (error.response?.status !== 404) {
          logError('Failed to fetch sub-events:', error)
        }
        setAllowedSubEvents([])
      }
      
      // Debug: Log API response to help diagnose staging issues
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
            id: 'tile-image-1',
            type: 'image',
            enabled: false,
            order: 1,
            settings: { src: '', fitMode: 'fit-to-screen' },
          },
          {
            id: 'tile-event-details-2',
            type: 'event-details',
            enabled: true,
            order: 2,
            settings: {
              location: data?.city || '',
              date: data?.date || new Date().toISOString().split('T')[0],
            },
          },
          {
            id: 'tile-description-3',
            type: 'description',
            enabled: false,
            order: 3,
            settings: { content: '' },
          },
          {
            id: 'tile-timer-4',
            type: 'timer',
            enabled: false,
            order: 4,
            settings: { enabled: true, format: 'circle', circleColor: '#0D6EFD', textColor: '#000000' },
          },
          {
            id: 'tile-feature-buttons-5',
            type: 'feature-buttons',
            enabled: true,
            order: 5,
            settings: { buttonColor: '#0D6EFD' },
          },
          {
            id: 'tile-event-carousel-7',
            type: 'event-carousel',
            enabled: false,
            order: 7,
            settings: {
              showFields: {
                image: true,
                title: true,
                dateTime: true,
                location: true,
                cta: true,
              },
            },
          },
          {
            id: 'tile-footer-8',
            type: 'footer',
            enabled: false,
            order: 8,
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

          // Preserve customColors, customFonts, texture, linkMetadata, and rsvpForm from loaded config
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
            texture: loadedConfig.texture !== undefined
              ? loadedConfig.texture
              : migratedConfig.texture,
            linkMetadata: loadedConfig.linkMetadata !== undefined
              ? loadedConfig.linkMetadata
              : migratedConfig.linkMetadata,
            rsvpForm: loadedConfig.rsvpForm !== undefined
              ? loadedConfig.rsvpForm
              : (migratedConfig as any).rsvpForm,
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
            const existingTiles = preservedConfig.tiles.map(tile => {
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
            
            // Ensure all tile types are present - add missing ones from defaults
            const defaultTiles = createDefaultTiles(eventData)
            const existingTileTypes = new Set(existingTiles.map(t => t.type))
            const missingTiles = defaultTiles.filter(t => !existingTileTypes.has(t.type))
            
            // Merge existing tiles with missing default tiles, preserving saved order
            const allTiles = [...existingTiles, ...missingTiles]
              .sort((a, b) => {
                // Keep existing tiles in their current order, new tiles go after
                const aExists = existingTiles.some(t => t.id === a.id)
                const bExists = existingTiles.some(t => t.id === b.id)
                if (aExists && !bExists) return -1
                if (!aExists && bExists) return 1
                // Sort by saved order value - preserve what was saved
                const orderA = a.order !== undefined ? a.order : (aExists ? 999 : 1000)
                const orderB = b.order !== undefined ? b.order : (bExists ? 999 : 1000)
                return orderA - orderB
              })
              .map((tile) => {
                // CRITICAL: Preserve existing order values from saved config
                // Only assign order to new tiles that don't have one
                const existingTile = existingTiles.find(t => t.id === tile.id)
                if (existingTile && existingTile.order !== undefined) {
                  // Preserve the saved order value - this is what the user set!
                  return { ...tile, order: existingTile.order }
                }
                // For new tiles, assign order after existing tiles
                const maxExistingOrder = existingTiles.length > 0 
                  ? Math.max(...existingTiles.map(t => t.order !== undefined ? t.order : 0), 0)
                  : -1
                return { ...tile, order: maxExistingOrder + 1 }
              })
            
            finalConfig = {
              ...preservedConfig,
              tiles: allTiles
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
        // But don't overwrite if it already exists (even if empty)
        if (!finalConfig.customColors) {
          finalConfig.customColors = {}
        }
      }
      
      // Set the final config
      if (finalConfig) {
        setConfig(finalConfig)
        
        // Initialize previewOrder from saved order values (fallback when previewOrder is empty)
        if (finalConfig.tiles && finalConfig.tiles.length > 0) {
          const initialPreviewOrder = new Map<string, number>()
          finalConfig.tiles.forEach(tile => {
            if (tile.order !== undefined) {
              initialPreviewOrder.set(tile.id, tile.order)
          }
          })
          setPreviewOrder(initialPreviewOrder)
        }
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
      // Validate that at least one tile is enabled
      const enabledTilesCount = config.tiles?.filter(t => t.enabled !== false).length || 0
      if (enabledTilesCount === 0) {
        showToast('At least one tile must be enabled to save the invite page design.', 'error')
        setSaving(false)
        return
      }
      
      // Validate enabled image tiles have images
      const enabledImageTiles = config.tiles?.filter(t => t.type === 'image' && t.enabled) || []
      for (const imageTile of enabledImageTiles) {
        const imageSettings = imageTile.settings as any
        if (!imageSettings?.src || imageSettings.src.trim() === '') {
          showToast('Image tile is enabled but no image is uploaded. Please upload an image or disable the image tile.', 'error')
          setSaving(false)
          return
        }
      }
      
      // Validate enabled title tiles have text
      const enabledTitleTiles = config.tiles?.filter(t => t.type === 'title' && t.enabled && !t.overlayTargetId) || []
      for (const titleTile of enabledTitleTiles) {
        const titleText = (titleTile.settings as any)?.text?.trim()
        if (!titleText || titleText === '') {
          showToast('Title tile is enabled but has no text. Please enter a title or disable the title tile.', 'error')
          setSaving(false)
          return
        }
      }
      
      // Build config to save - ensure customColors.backgroundColor is always included if set
      // Build tiles first - sort by previewOrder (real-time order) and snapshot to order field
      // IMPORTANT: This respects user's manual ordering (from drag-and-drop) because:
      // 1. When user reorders tiles, previewOrder is updated in state
      // 2. We sort by previewOrder (which reflects what user sees in preview)
      // 3. Then we snapshot previewOrder values into order field sequentially (0, 1, 2...)
      // CRITICAL: Only assign order to enabled tiles to match what invite page shows
      // This ensures the saved order matches what the user sees and expects
      const sortedTilesForSave = [...(config.tiles || [])].sort((a, b) => {
        // Use previewOrder from state map, fallback to tile's previewOrder, then saved order
        const orderA = previewOrder.get(a.id) ?? a.previewOrder ?? a.order ?? 0
        const orderB = previewOrder.get(b.id) ?? b.previewOrder ?? b.order ?? 0
        return orderA - orderB
      })
      
      // Separate enabled and disabled tiles (simple filter, no special requirements)
      let enabledTiles = sortedTilesForSave.filter(t => t.enabled !== false)
      let disabledTiles = sortedTilesForSave.filter(t => t.enabled === false)
      
      // Ensure all enabled tiles have previewOrder before assigning final order values
      enabledTiles = enabledTiles.map(tile => {
        // If tile doesn't have previewOrder, use its position in sortedTilesForSave
        if (!previewOrder.has(tile.id) && tile.previewOrder === undefined) {
          const positionInSorted = sortedTilesForSave.findIndex(t => t.id === tile.id)
          if (positionInSorted >= 0) {
            // Use position in sorted array as previewOrder
            return { ...tile, previewOrder: positionInSorted }
          }
        }
        return tile
      })
      
      // Sort enabled tiles by previewOrder
      enabledTiles.sort((a, b) => {
        const orderA = previewOrder.get(a.id) ?? a.previewOrder ?? a.order ?? 999
        const orderB = previewOrder.get(b.id) ?? b.previewOrder ?? b.order ?? 999
        return orderA - orderB
      })
      
      // Assign order values only to enabled tiles (sequential: 0, 1, 2...)
      // Disabled tiles keep their existing order (or get a high value) but won't be shown on invite page
      const tilesToSave = [
        ...enabledTiles.map((t, index) => {
          // Snapshot: copy previewOrder to order field for saving (only for enabled tiles)
          const baseTile = { 
            ...t, 
            order: index, // Snapshot previewOrder as sequential order values for enabled tiles
            previewOrder: undefined, // Don't save previewOrder to backend
          }
          
          // CRITICAL: Always get latest settings from current config state (not from sorted array which might be stale)
          // This ensures all tile updates are saved, not just initial values
          const currentTileInConfig = config.tiles?.find(t => t.id === baseTile.id)
          const latestSettings = currentTileInConfig?.settings || baseTile.settings
          
          if (baseTile.type === 'title') {
            return { ...baseTile, enabled: true, settings: { ...latestSettings } as any }
          }
          // For image tiles, explicitly preserve all settings including coverPosition
          if (baseTile.type === 'image') {
            const imageSettings = latestSettings as any
            return { ...baseTile, settings: { ...imageSettings } }
          }
          // For feature-buttons tiles, explicitly preserve all settings including custom labels
          if (baseTile.type === 'feature-buttons') {
            const featureButtonsSettings = latestSettings as any
            return { ...baseTile, settings: { ...featureButtonsSettings } }
          }
          // For event-carousel tiles, explicitly preserve all settings including slideshow and styling options
          if (baseTile.type === 'event-carousel') {
            const carouselSettings = latestSettings as any
            return { ...baseTile, settings: { ...carouselSettings } }
          }
          // For event-details tiles, explicitly preserve all settings including time
          if (baseTile.type === 'event-details') {
            const eventDetailsSettings = latestSettings as any
            // Explicitly preserve ALL fields from the latest settings
            const preservedSettings = {
              ...eventDetailsSettings, // Spread all current settings
              // Explicitly preserve each field to ensure nothing is lost
              location: eventDetailsSettings.location || '',
              date: eventDetailsSettings.date || '',
              time: eventDetailsSettings.time, // Can be undefined, that's fine
              dressCode: eventDetailsSettings.dressCode,
              mapUrl: eventDetailsSettings.mapUrl,
              locationVerified: eventDetailsSettings.locationVerified,
              coordinates: eventDetailsSettings.coordinates,
              showMap: eventDetailsSettings.showMap,
              mapZoom: eventDetailsSettings.mapZoom,
              fontColor: eventDetailsSettings.fontColor,
              buttonColor: eventDetailsSettings.buttonColor,
              borderStyle: eventDetailsSettings.borderStyle,
              borderColor: eventDetailsSettings.borderColor,
              borderWidth: eventDetailsSettings.borderWidth,
              decorativeSymbol: eventDetailsSettings.decorativeSymbol,
              backgroundColor: eventDetailsSettings.backgroundColor,
              borderRadius: eventDetailsSettings.borderRadius,
            }
            return { ...baseTile, settings: preservedSettings }
          }
          // For all other tile types, use latest settings
          return { ...baseTile, settings: { ...latestSettings } as any }
        }),
        // Disabled tiles keep their existing order (won't be shown on invite page anyway)
        ...disabledTiles.map(t => ({
          ...t,
          previewOrder: undefined, // Don't save previewOrder to backend
        }))
      ]
      
      // Build customColors - always include backgroundColor if it exists
      let customColorsToSave = undefined
      if (config.customColors?.backgroundColor) {
        // If backgroundColor is set, include it along with any other customColors properties
        customColorsToSave = {
          ...(config.customColors || {}),
          backgroundColor: config.customColors.backgroundColor,
        }
      } else if (config.customColors && Object.keys(config.customColors).filter(k => k !== 'backgroundColor').length > 0) {
        // Include customColors if it has other properties (fontColor, primaryColor, etc.)
        customColorsToSave = config.customColors
      }
      // If customColors is empty or doesn't exist, don't include it (undefined)
      
      // Clean up linkMetadata - only include if it has at least one defined property
      const linkMetadataToSave = config.linkMetadata && 
        (config.linkMetadata.title || config.linkMetadata.description || config.linkMetadata.image)
        ? config.linkMetadata
        : undefined
      
      const configToSave: InviteConfig = {
        themeId: config.themeId,
        tiles: tilesToSave,
        ...(customColorsToSave && { customColors: customColorsToSave }),
        ...(config.customFonts && { customFonts: config.customFonts }),
        ...(config.texture && { texture: config.texture }),
        ...(config.pageBorder && { pageBorder: config.pageBorder }),
        ...(linkMetadataToSave && { linkMetadata: linkMetadataToSave }),
        ...(config.rsvpForm && { rsvpForm: config.rsvpForm }),
      }
      
      const imageTile = configToSave.tiles?.find(t => t.type === 'image')
      if (imageTile) {
      }
      
      const response = await api.put(`/api/events/${eventId}/design/`, {
        page_config: configToSave,
      })
      
      // Fix 1: Check if InvitePage was auto-created
      if (response.data.invite_page_created) {
        // Reload InvitePage to get the created one
        try {
          const invite = await getInvitePage(eventId)
          setInvitePage(invite)
          showToast('Invitation saved and invite page created!', 'success')
        } catch (error) {
          // If reload fails, still update state with basic info from event
          // This ensures publish button works even if getInvitePage fails
          if (event?.slug) {
            setInvitePage({
              id: 0, // Will be set when we successfully load it
              slug: event.slug,
              is_published: false,
              config: configToSave,
              background_url: event.banner_image || '',
              event: eventId,
            } as any)
            showToast('Invitation saved! (Reloading invite page...)', 'success')
            // Try to reload in background
            setTimeout(async () => {
              try {
                const invite = await getInvitePage(eventId)
                setInvitePage(invite)
              } catch (e) {
                // Silent fail - state is already set
              }
            }, 1000)
          } else {
            showToast('Invitation saved successfully!', 'success')
          }
        }
      } else {
        // Update invitePage state if it exists
        if (invitePage && response.data.is_published !== undefined) {
          setInvitePage({ ...invitePage, is_published: response.data.is_published })
        }
        showToast('Invitation saved successfully!', 'success')
        
        // Broadcast update to all tabs viewing this invite page (preview + live)
        // This works even if preview window is closed or in different tabs (industry standard)
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window && event?.slug) {
          const channelName = `invite-${event.slug}-updates`
          const channel = new BroadcastChannel(channelName)
          channel.postMessage({ 
            type: 'REFRESH_INVITE_PAGE', 
            slug: event.slug,
            timestamp: Date.now()
          })
          channel.close()
        }
        
        // Also refresh preview window if it's open (direct method for immediate feedback)
        if (previewWindowRef.current && !previewWindowRef.current.closed) {
          // Send refresh message to preview window
          previewWindowRef.current.postMessage(
            { type: 'REFRESH_INVITE_PAGE', slug: event?.slug },
            window.location.origin
          )
          // Also trigger a reload (cache-busting handled by headers and backend)
          previewWindowRef.current.location.href = `/invite/${event?.slug}?preview=true`
        }
      }
    } catch (error: any) {
      logError('Failed to save:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  // Resize and optimize image for link previews (1200x630px)
  const resizeImageForPreview = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          // Target dimensions for link previews (Open Graph standard)
          const targetWidth = 1200
          const targetHeight = 630

          // Calculate dimensions maintaining aspect ratio
          let width = img.width
          let height = img.height
          const aspectRatio = width / height
          const targetAspectRatio = targetWidth / targetHeight

          if (aspectRatio > targetAspectRatio) {
            // Image is wider - fit to height
            height = targetHeight
            width = height * aspectRatio
          } else {
            // Image is taller - fit to width
            width = targetWidth
            height = width / aspectRatio
          }

          // Set canvas size
          canvas.width = targetWidth
          canvas.height = targetHeight

          // Fill with white background (for images that don't fill the entire space)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, targetWidth, targetHeight)

          // Calculate center position
          const x = (targetWidth - width) / 2
          const y = (targetHeight - height) / 2

          // Draw resized image
          ctx.drawImage(img, x, y, width, height)

          // Adaptive compression to meet WhatsApp's 300KB requirement
          const MAX_SIZE = 300 * 1024 // 300KB - WhatsApp's limit
          const MIN_QUALITY = 0.5 // Minimum quality to prevent too much degradation
          
          const compressToTargetSize = (quality: number): Promise<File> => {
            return new Promise((resolve, reject) => {
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Failed to create blob'))
                    return
                  }
                  
                  // Check if file size is under WhatsApp's limit
                  if (blob.size <= MAX_SIZE || quality <= MIN_QUALITY) {
                    // Create a new File with optimized image
                    const optimizedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    })
                    resolve(optimizedFile)
                  } else {
                    // Reduce quality by 0.1 and try again
                    // This ensures we get as close to 300KB as possible without going over
                    compressToTargetSize(Math.max(quality - 0.1, MIN_QUALITY))
                      .then(resolve)
                      .catch(reject)
                  }
                },
                'image/jpeg',
                quality
              )
            })
          }

          // Start with 0.9 quality (high quality), reduce if needed
          compressToTargetSize(0.9)
            .then(resolve)
            .catch(reject)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const getImageDimensions = (src: string): Promise<{ width: number; height: number; aspectRatio: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          aspectRatio: img.width && img.height ? img.width / img.height : 1,
        })
      }
      img.onerror = () => reject(new Error('Failed to load image for dimensions'))
      img.src = src
    })
  }

  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const safeName = filename?.trim() ? filename.trim() : 'preview.jpg'
    const base = safeName.replace(/\.[^/.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  }

  const openPreviewCropper = async (src: string, filename: string) => {
    const dims = await getImageDimensions(src)
    setPreviewCropSrc(src)
    setPreviewCropFilename(filename || 'preview.jpg')
    setPreviewCropDimensions(dims)
    setIsPreviewCropOpen(true)
  }

  // Handle preview image upload
  const handlePreviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    // 3MB limit - optimal balance between quality and processing speed
    // Since we resize to 1200x630 and compress to <300KB, 3MB source is plenty
    const MAX_UPLOAD_SIZE = 3 * 1024 * 1024 // 3MB
    if (file.size > MAX_UPLOAD_SIZE) {
      showToast('Image must be less than 3MB. Please use a smaller image or compress it first.', 'error')
      return
    }

    setUploadingPreviewImage(true)
    try {
      // Upload the original image first so we have a stable URL for re-editing framing later
      const originalUrl = await uploadImage(file, eventId)

      // Store original URL for future “Adjust framing”
      setConfig(prev => ({
        ...prev,
        linkMetadata: {
          ...prev.linkMetadata,
          previewImageOriginal: originalUrl,
        },
      }))

      // Open cropper to let host choose what’s visible in the 1200x630 frame
      await openPreviewCropper(originalUrl, file.name)
    } catch (error) {
      logError('Failed to upload preview image:', error)
      showToast('Failed to upload image. Please try again.', 'error')
    } finally {
      setUploadingPreviewImage(false)
      // Reset file input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const handleAdjustPreviewFraming = async () => {
    const src = config.linkMetadata?.previewImageOriginal || config.linkMetadata?.image
    if (!src) return
    try {
      setUploadingPreviewImage(true)
      await openPreviewCropper(src, previewCropFilename)
    } catch (error) {
      logError('Failed to open preview cropper:', error)
      showToast('Could not open framing tool. Please try again.', 'error')
    } finally {
      setUploadingPreviewImage(false)
    }
  }

  const handleApplyPreviewCrop = async (
    originalImageSrc: string,
    metadata: { cropData: { x: number; y: number; width: number; height: number }; aspectRatio: number }
  ) => {
    setUploadingPreviewImage(true)
    try {
      // Crop to exactly 1200x630 for maximum consistency across platforms
      const croppedDataUrl = await cropImage(originalImageSrc, metadata.cropData, 1200, 630)
      const croppedFile = await dataUrlToFile(croppedDataUrl, previewCropFilename)

      // Compress to meet WhatsApp 300KB requirement (keeps 1200x630)
      const optimizedFile = await resizeImageForPreview(croppedFile)

      // Upload final OG image
      const imageUrl = await uploadImage(optimizedFile, eventId)

      setConfig(prev => ({
        ...prev,
        linkMetadata: {
          ...prev.linkMetadata,
          image: imageUrl,
          previewImageCrop: metadata.cropData,
          previewImageCropAspectRatio: metadata.aspectRatio,
        },
      }))

      const finalSizeKB = (optimizedFile.size / 1024).toFixed(1)
      const sizeInfo = optimizedFile.size <= 300 * 1024 ? ` (${finalSizeKB}KB - WhatsApp compatible)` : ` (${finalSizeKB}KB)`
      showToast(`Preview image saved${sizeInfo}`, 'success')
      setIsPreviewCropOpen(false)
    } catch (error) {
      logError('Failed to apply preview crop:', error)
      showToast('Failed to save framing. Please try again.', 'error')
    } finally {
      setUploadingPreviewImage(false)
    }
  }

  // Fix 2: Add publish handler
  const handlePublish = async () => {
    let currentInvitePage = invitePage
    
    // If invitePage state is missing, try to fetch it first
    if (!currentInvitePage && event?.slug) {
      try {
        // Try to get it using slug (more reliable than ID)
        const fetched = await getPublicInvite(event.slug)
        setInvitePage(fetched)
        currentInvitePage = fetched
      } catch (error) {
        // If that fails, try ID-based endpoint
        try {
          const fetched = await getInvitePage(eventId)
          setInvitePage(fetched)
          currentInvitePage = fetched
        } catch (error2) {
          // If both fail, create it
          try {
            const newInvite = await createInvitePage(eventId, {
              config: config,
              background_url: event?.banner_image || '',
            })
            setInvitePage(newInvite)
            currentInvitePage = newInvite
          } catch (error3) {
            logError('Failed to create invite page:', error3)
            showToast('Failed to create invite page. Please save your design first.', 'error')
            return
          }
        }
      }
    } else if (!currentInvitePage) {
      // No slug available, try ID-based endpoint
      try {
        const fetched = await getInvitePage(eventId)
        setInvitePage(fetched)
        currentInvitePage = fetched
      } catch (error) {
        // If that fails, create it
        try {
          const newInvite = await createInvitePage(eventId, {
            config: config,
            background_url: event?.banner_image || '',
          })
          setInvitePage(newInvite)
          currentInvitePage = newInvite
        } catch (error2) {
          logError('Failed to create invite page:', error2)
          showToast('Failed to create invite page. Please save your design first.', 'error')
          return
        }
      }
    }
    
    setIsPublishing(true)
    try {
      // Use currentInvitePage.slug (from state or newly created) or fallback to event.slug
      const slugToUse = currentInvitePage?.slug || event?.slug || ''
      if (!slugToUse) {
        showToast('Event slug not found', 'error')
        return
      }
      
      const updated = await publishInvitePage(slugToUse, true)
      setInvitePage(updated)
      showToast('Invite page published!', 'success')
      setShowPublishModal(false)
    } catch (error: any) {
      logError('Failed to publish:', error)
      // Provide more specific error messages
      if (error.response?.status === 404) {
        showToast('Invite page not found. Please save your design first.', 'error')
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        showToast('You do not have permission to publish this invite page.', 'error')
      } else if (error.response?.data?.error) {
        // Show backend error message if available
        showToast(error.response.data.error, 'error')
      } else if (error.message) {
        showToast(`Failed to publish: ${error.message}`, 'error')
      } else {
        showToast('Failed to publish invite page. Please try again.', 'error')
      }
    } finally {
      setIsPublishing(false)
    }
  }

  // Fix 3: Validate preview before opening
  const handlePreview = async () => {
    if (!event?.slug) {
      showToast('Event slug not found', 'error')
      return
    }
    
    // Check if InvitePage exists
    if (!invitePage) {
      const shouldCreate = confirm(
        'Invite page not created yet. Create it now to preview?'
      )
      if (shouldCreate) {
        try {
          const newInvite = await createInvitePage(eventId, {
            config: config,
            background_url: event?.banner_image || '',
          })
          setInvitePage(newInvite)
          showToast('Invite page created. Opening preview...', 'success')
          // Add preview=true to bypass cache for editor
          // Store reference to preview window for refresh messages
          previewWindowRef.current = window.open(`/invite/${event.slug}?preview=true`, '_blank')
        } catch (error) {
          logError('Failed to create invite page:', error)
          showToast('Failed to create invite page', 'error')
        }
      }
      return
    }
    
    // Check if published
    if (!invitePage.is_published) {
      showToast(
        'Invite page is not published. It may not be accessible publicly.',
        'info'
      )
    }
    
    // Add preview=true to bypass cache for editor
    // Store reference to preview window for refresh messages
    // If preview window already exists, refresh it; otherwise open new one
    const previewUrl = `/invite/${event.slug}?preview=true`
    if (previewWindowRef.current && !previewWindowRef.current.closed) {
      // Preview window is still open, refresh it (cache-busting handled by headers)
      previewWindowRef.current.location.href = previewUrl
    } else {
      // Open new preview window
      previewWindowRef.current = window.open(previewUrl, '_blank')
    }
  }

  const handleTileUpdate = (updatedTile: Tile) => {
    setConfig(prev => ({
      ...prev,
      tiles: prev.tiles?.map(t => t.id === updatedTile.id ? updatedTile : t) || [],
    }))
  }

  const handleTileToggle = (tileId: string, enabled: boolean) => {
    const tile = config.tiles?.find(t => t.id === tileId)
    
    // Check if trying to disable title tile
    if (tile?.type === 'title' && !enabled) {
      // Check if there's an enabled image tile with a valid image source - if yes, allow disabling title
      const enabledImageTiles = config.tiles?.filter(t => t.type === 'image' && t.enabled) || []
      const hasValidImageTile = enabledImageTiles.some(t => {
        const imageSettings = t.settings as any
        return imageSettings?.src && imageSettings.src.trim() !== ''
      })
      
      if (!hasValidImageTile) {
        showToast('Title tile cannot be disabled when no valid image is present. Please add and upload an image first.', 'error')
        return
      }
      // If valid image exists, allow disabling title tile
    }
    
    setConfig(prev => ({
      ...prev,
      tiles: prev.tiles?.map(t => t.id === tileId ? { ...t, enabled } : t) || [],
    }))
  }

  const handleTileReorder = (reorderedTiles: Tile[]) => {
    // CRITICAL: Calculate previewOrder for ALL tiles based on their position in the reordered array
    // This ensures every tile has a previewOrder that reflects its actual position, not just moved tiles
    const newPreviewOrder = new Map<string, number>()
    
    // Filter out overlay titles for ordering calculation (they'll get same order as their target)
    const tilesForOrdering = reorderedTiles.filter(tile => {
      if (tile.type === 'title' && tile.overlayTargetId) return false
      return true
    })
    
    // Assign previewOrder based on actual position in reordered array
    tilesForOrdering.forEach((tile, index) => {
      newPreviewOrder.set(tile.id, index)
      // Overlay titles get same previewOrder as their target
      const overlayTitle = reorderedTiles.find(t => t.type === 'title' && t.overlayTargetId === tile.id)
      if (overlayTitle) {
        newPreviewOrder.set(overlayTitle.id, index)
      }
    })
    
    // Ensure ALL tiles have previewOrder (including any that might have been missed)
    reorderedTiles.forEach((tile) => {
      if (!newPreviewOrder.has(tile.id)) {
        // If tile doesn't have previewOrder yet, use its position in the array
        const position = reorderedTiles.findIndex(t => t.id === tile.id)
        if (position >= 0) {
          newPreviewOrder.set(tile.id, position)
        } else {
          // Fallback to existing previewOrder or saved order
          newPreviewOrder.set(tile.id, previewOrder.get(tile.id) ?? tile.order ?? 0)
        }
      }
    })
    
    setPreviewOrder(newPreviewOrder)
    
    // Update tiles with their previewOrder values
    const tilesWithPreviewOrder = reorderedTiles.map(tile => ({
      ...tile,
      previewOrder: newPreviewOrder.get(tile.id),
    }))
    
    setConfig(prev => ({
      ...prev,
      tiles: tilesWithPreviewOrder,
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
  let sortedTiles: Tile[] = []
  if (config.tiles && config.tiles.length > 0) {
    // Sort by previewOrder (real-time order) with fallback to saved order
    sortedTiles = [...config.tiles].sort((a, b) => {
      const orderA = previewOrder.get(a.id) ?? a.previewOrder ?? a.order ?? 0
      const orderB = previewOrder.get(b.id) ?? b.previewOrder ?? b.order ?? 0
      return orderA - orderB
    })
  } else {
    logError('No tiles in config, using DEFAULT_TILES')
    sortedTiles = DEFAULT_TILES
  }

  return (
    <div className="min-h-screen bg-eco-beige w-full overflow-x-hidden">
        {/* Header */}
      <div ref={headerRef} className="sticky top-0 z-30 bg-white border-b w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 w-full overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 w-full">
          <div className="flex-1 min-w-0 w-full">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Link href={`/host/events/${eventId}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-eco-green text-eco-green hover:bg-eco-green-light"
                >
                  Back to Event
                </Button>
              </Link>
              <Link href={`/host/events/${eventId}/guests`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-eco-green text-eco-green hover:bg-eco-green-light"
                >
                  Guests
                </Button>
              </Link>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-eco-green break-words">Design Invitation Page</h1>
              <p className="text-gray-600 mt-1 text-xs sm:text-sm break-words">Customize your invitation page by arranging and configuring tiles. Drag tiles in the mobile preview to reorder them.</p>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto items-center">
            {/* Fix 2: Publish Status Badge */}
            {invitePage?.is_published ? (
              <Badge variant="success" className="text-xs">Published</Badge>
            ) : invitePage ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="warning" className="text-xs">Draft</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your invite page is in draft mode. Publish it to share with guests.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            
            {/* Preview/View Site button - changes based on publish status */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handlePreview}
                    variant="outline" 
                    className="border-eco-green text-eco-green text-xs sm:text-sm px-3 sm:px-4 w-full sm:w-auto flex-1 sm:flex-none"
                  >
                    {invitePage?.is_published ? (
                      <>
                        👁️ <span className="hidden sm:inline">View Site</span>
                      </>
                    ) : (
                      <>
              👁️ <span className="hidden sm:inline">Preview</span>
                      </>
                    )}
            </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {invitePage?.is_published 
                      ? 'View your published invite page as guests see it'
                      : 'Preview your draft invite page (host only)'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-eco-green hover:bg-green-600 text-white text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none w-full sm:w-auto"
            >
              {saving ? 'Saving...' : <><span className="hidden sm:inline">💾 </span>Save</>}
            </Button>
            
            {/* Fix 2: Publish button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={async () => {
                      // Ensure InvitePage exists before opening modal
                      if (!invitePage) {
                        try {
                          // Create InvitePage if it doesn't exist
                          const newInvite = await createInvitePage(eventId, {
                            config: config,
                            background_url: event?.banner_image || '',
                          })
                          setInvitePage(newInvite)
                          setShowPublishModal(true)
                        } catch (error) {
                          logError('Failed to create invite page:', error)
                          showToast('Please save your design first, then publish', 'error')
                        }
                      } else {
                        setShowPublishModal(true)
                      }
                    }}
                    disabled={isPublishing}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none w-full sm:w-auto"
                  >
                    {invitePage?.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {invitePage?.is_published 
                      ? 'Unpublish your invite page and move it back to draft'
                      : 'Publish your invite page to make it publicly accessible'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 w-full overflow-x-hidden pt-4 sm:pt-6 pb-6">
        {/* Fix 5: State-based info banners */}
        {(() => {
          const state = getInvitePageState(invitePage)
          if (state === InvitePageState.NOT_CREATED) {
            return (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 Design and save your invitation to create the invite page.
                </p>
              </div>
            )
          }
          if (state === InvitePageState.DRAFT) {
            return (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Your invite page is in draft mode. Publish it to share with guests.
                </p>
              </div>
            )
          }
          return null
        })()}
        
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

                {/* Advanced Settings - Collapsible */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-green rounded-md p-2 -m-2"
                  >
                    <h3 className="text-sm font-semibold text-eco-green">Advanced Settings</h3>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${showAdvancedSettings ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAdvancedSettings && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Background Texture</label>
                        <select
                          value={config.texture?.type || 'none'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            texture: {
                              ...prev.texture,
                              type: e.target.value as any,
                              intensity: prev.texture?.intensity || 40,
                            },
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="none">None</option>
                          <option value="paper-grain">Paper Grain</option>
                          <option value="linen">Linen</option>
                          <option value="canvas">Canvas</option>
                          <option value="parchment">Parchment</option>
                          <option value="vintage-paper">Vintage Paper</option>
                          <option value="silk">Silk</option>
                          <option value="marble">Marble</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          CSS-based texture overlay for a vintage, textured paper effect
                        </p>
                      </div>

                      {config.texture?.type && config.texture.type !== 'none' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Texture Intensity: {config.texture?.intensity || 40}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.texture?.intensity || 40}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              texture: {
                                ...prev.texture!,
                                intensity: parseInt(e.target.value, 10),
                              },
                            }))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Adjust the opacity of the texture overlay (0-100%)
                          </p>
                        </div>
                      )}

                      {/* Page Border Settings */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium">Page Border</label>
                          <input
                            type="checkbox"
                            checked={config.pageBorder?.enabled || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              pageBorder: {
                                ...prev.pageBorder,
                                enabled: e.target.checked,
                                style: prev.pageBorder?.style || 'solid',
                                color: prev.pageBorder?.color || '#D1D5DB',
                                width: prev.pageBorder?.width || 2,
                              },
                            }))}
                            className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
                          />
                        </div>
                        {config.pageBorder?.enabled && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-2">Border Style</label>
                              <select
                                value={config.pageBorder?.style || 'solid'}
                                onChange={(e) => setConfig(prev => ({
                                  ...prev,
                                  pageBorder: {
                                    ...prev.pageBorder,
                                    style: e.target.value as any,
                                  },
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                              >
                                <option value="solid">Solid</option>
                                <option value="dotted">Dotted</option>
                                <option value="dashed">Dashed</option>
                                <option value="double">Double</option>
                                <option value="groove">Groove</option>
                                <option value="ridge">Ridge</option>
                                <option value="inset">Inset</option>
                                <option value="outset">Outset</option>
                                <option value="intaglio">Intaglio (Decorative)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Border Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={config.pageBorder?.color || '#D1D5DB'}
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    pageBorder: {
                                      ...prev.pageBorder,
                                      color: e.target.value,
                                    },
                                  }))}
                                  className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                                />
                                <Input
                                  type="text"
                                  value={config.pageBorder?.color || '#D1D5DB'}
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    pageBorder: {
                                      ...prev.pageBorder,
                                      color: e.target.value,
                                    },
                                  }))}
                                  placeholder="#D1D5DB"
                                  className="flex-1"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">
                                Border Width: {config.pageBorder?.width || 2}px
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="8"
                                value={config.pageBorder?.width || 2}
                                onChange={(e) => setConfig(prev => ({
                                  ...prev,
                                  pageBorder: {
                                    ...prev.pageBorder,
                                    width: parseInt(e.target.value),
                                  },
                                }))}
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Link Preview Settings - Collapsible */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowLinkMetadata(!showLinkMetadata)}
                    className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-green rounded-md p-2 -m-2"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-eco-green">Link Preview Settings</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Customize how your invite appears when shared on WhatsApp, Facebook, and other platforms</p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${showLinkMetadata ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showLinkMetadata && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Preview Title
                          <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </label>
                        <Input
                          type="text"
                          value={config.linkMetadata?.title || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            linkMetadata: {
                              ...prev.linkMetadata,
                              title: e.target.value || undefined,
                            },
                          }))}
                          placeholder="Leave empty to use page title"
                          className="w-full"
                          maxLength={60}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Custom title for link previews (recommended: 50-60 characters). Leave empty to auto-generate from page title.
                        </p>
                        {config.linkMetadata?.title && (
                          <p className="text-xs mt-1 text-gray-400">
                            {config.linkMetadata.title.length} / 60 characters
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Preview Description
                          <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </label>
                        <textarea
                          value={config.linkMetadata?.description || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            linkMetadata: {
                              ...prev.linkMetadata,
                              description: e.target.value || undefined,
                            },
                          }))}
                          placeholder="Leave empty to use page description"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green resize-none"
                          rows={3}
                          maxLength={200}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Custom description for link previews (recommended: 150-200 characters). Leave empty to auto-generate from page content.
                        </p>
                        {config.linkMetadata?.description && (
                          <p className="text-xs mt-1 text-gray-400">
                            {config.linkMetadata.description.length} / 200 characters
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Preview Image
                          <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </label>
                        {config.linkMetadata?.image ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <img
                                src={config.linkMetadata.image}
                                alt="Preview"
                                className="w-full max-w-md h-48 object-contain bg-white rounded border border-gray-300"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setConfig(prev => ({
                                  ...prev,
                                  linkMetadata: {
                                    ...prev.linkMetadata,
                                    image: undefined,
                                    previewImageOriginal: undefined,
                                    previewImageCrop: undefined,
                                    previewImageCropAspectRatio: undefined,
                                  },
                                }))}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                title="Remove image"
                              >
                                ×
                              </button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAdjustPreviewFraming}
                              disabled={uploadingPreviewImage}
                              className="w-full"
                            >
                              Adjust framing
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                previewImageInputRef.current?.click()
                              }}
                              disabled={uploadingPreviewImage}
                              className="w-full"
                            >
                              {uploadingPreviewImage ? 'Uploading...' : 'Replace Image'}
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <input
                              ref={previewImageInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handlePreviewImageUpload}
                              className="hidden"
                              id="preview-image-upload"
                              disabled={uploadingPreviewImage}
                            />
                            <label
                              htmlFor="preview-image-upload"
                              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              {uploadingPreviewImage ? (
                                <div className="flex flex-col items-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-eco-green mb-2"></div>
                                  <span className="text-sm text-gray-600">Uploading and optimizing...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span className="text-sm text-gray-600">Click to upload preview image</span>
                                  <span className="text-xs text-gray-400 mt-1">Recommended: 1200x630px (will be auto-optimized)</span>
                                </div>
                              )}
                            </label>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Custom image for link previews (WhatsApp, Facebook, Twitter). Recommended: <strong>1200×630 (1.91:1)</strong>. Platforms may crop thumbnails—keep key text/faces centered with padding.
                          Use <strong>Adjust framing</strong> to choose what’s visible in the 1200×630 frame.
                        </p>
                        <p className="text-xs text-eco-green mt-1 font-medium">
                          WhatsApp requires preview images under 300KB - your image will be automatically compressed to meet this requirement.
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-xs text-blue-800">
                          <strong>💡 Tip:</strong> These settings control how your invite appears when shared on WhatsApp, Facebook, Twitter, and other platforms. If left empty, the system will automatically generate previews from your page content.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-eco-green">
                  Tile Settings
                  {sortedTiles && sortedTiles.length > 0 && (
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      ({sortedTiles.length} {sortedTiles.length === 1 ? 'tile' : 'tiles'})
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setAllTilesExpanded(!allTilesExpanded)}
                  className="text-xs text-eco-green hover:underline px-2 py-1 rounded hover:bg-eco-green-light transition-colors"
                  type="button"
                >
                  {allTilesExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              {sortedTiles && sortedTiles.length > 0 ? (
                <TileSettingsList
                  tiles={sortedTiles}
                  onReorder={handleTileReorder}
                  onUpdate={handleTileUpdate}
                  onToggle={handleTileToggle}
                  onOverlayToggle={handleOverlayToggle}
                  eventId={eventId}
                  hasRsvp={event?.has_rsvp}
                  hasRegistry={event?.has_registry}
                  forceExpanded={allTilesExpanded}
                />
              ) : (
                <p className="text-gray-500 text-sm">No tiles available</p>
              )}
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
              <h2 className="text-base sm:text-lg font-semibold text-eco-green mb-2">
                Mobile Preview
                {sortedTiles && (
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    ({sortedTiles.filter(t => t.enabled).length} of {sortedTiles.length} enabled)
                  </span>
                )}
              </h2>
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
                      <>
                        <TileList
                          tiles={sortedTiles}
                          onReorder={handleTileReorder}
                          eventDate={event?.date}
                          eventSlug={event?.slug}
                              eventTitle={(sortedTiles.find(t => t.type === 'title')?.settings as { text?: string })?.text || event?.title || 'Event'}
                          hasRsvp={event?.has_rsvp}
                          hasRegistry={event?.has_registry}
                          allowedSubEvents={allowedSubEvents}
                        />
                      </>
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
      
      {isPreviewCropOpen && previewCropSrc && previewCropDimensions && (
        <ImageCropModal
          imageSrc={previewCropSrc}
          imageDimensions={previewCropDimensions}
          recommendedAspectRatio={1200 / 630}
          allowedAspectRatios={[1200 / 630]}
          existingCropData={config.linkMetadata?.previewImageCrop}
          existingAspectRatio={config.linkMetadata?.previewImageCropAspectRatio}
          onCrop={handleApplyPreviewCrop}
          onCancel={() => setIsPreviewCropOpen(false)}
          onClose={() => setIsPreviewCropOpen(false)}
        />
      )}

      {/* Fix 2: Publish Modal */}
      {showPublishModal && (
        <PublishModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          slug={event?.slug || ''}
          isPublished={invitePage?.is_published || false}  // Pass current publish status
          onPublishChange={(published) => {
            if (invitePage) {
              setInvitePage({ ...invitePage, is_published: published })
            }
          }}
        />
      )}
    </div>
  )
}