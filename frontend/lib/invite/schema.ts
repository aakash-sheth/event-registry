/**
 * TypeScript schema for Living Poster Invitation configuration
 */

export interface BackgroundImage {
  type: 'image'
  src: string
  parallax?: boolean
  // Background adjustment options
  fitMode?: 'cover' | 'contain' | 'picture-in-picture' | 'blur-fill'
  backgroundColor?: string // Extracted or user-selected color
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  focusPoint?: { x: number; y: number } // 0-100, center of important content for responsive positioning
  scale?: number // 0.5 to 2.0
  originalAspectRatio?: { width: number; height: number }
  dominantColors?: string[] // Extracted dominant colors
}

// Tile-based structure
export type TileType = 'title' | 'image' | 'timer' | 'event-details' | 'description' | 'feature-buttons' | 'footer'

export interface TitleTileSettings {
  text: string
  font?: string // Font family from FONT_OPTIONS
  color?: string // Hex color
  size?: 'small' | 'medium' | 'large' | 'xlarge' // Title size option
  overlayMode?: boolean // When overlaid on Image tile
  overlayPosition?: { x: number; y: number } // Position within image (0-100)
}

export interface ImageTileSettings {
  src?: string // Image URL or data URL
  fitMode?: 'fit-to-screen' | 'full-image'
  backgroundColor?: string // Background color if image doesn't fill
  blur?: number // 0-100, only when Title overlay is active
  coverPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | { x: number; y: number } // Position for cover image mode (x, y are 0-100 percentages)
}

export interface TimerTileSettings {
  enabled: boolean
  format: 'circle' | 'inline' // Circle format: (12) Days (20) Hours | Inline: Days:Hours:Mins
  circleColor?: string // Color for circles (hex color or 'transparent')
  textColor?: string // Color for timer text (hex color)
}

export interface EventDetailsTileSettings {
  location: string
  date: string // ISO date string
  time?: string // Time string (e.g., "18:00")
  dressCode?: string
  mapUrl?: string // Map URL for location (Google Maps, Apple Maps, etc.)
}

export interface DescriptionTileSettings {
  content: string // Rich text/markdown content
}

export interface FeatureButtonsTileSettings {
  buttonColor?: string // Hex color for buttons
}

export interface FooterTileSettings {
  text: string
}

export type TileSettings = 
  | TitleTileSettings
  | ImageTileSettings
  | TimerTileSettings
  | EventDetailsTileSettings
  | DescriptionTileSettings
  | FeatureButtonsTileSettings
  | FooterTileSettings

export interface Tile {
  id: string
  type: TileType
  enabled: boolean
  order: number // Display order (0-based, footer should be last)
  settings: TileSettings
  overlayTargetId?: string // If this tile is overlaid on another (e.g., title on image)
}

export interface InviteConfig {
  themeId: string
  // Custom overrides (optional - if not set, uses theme defaults)
  customColors?: {
    backgroundColor?: string // Overrides theme.palette.bg
    fontColor?: string // Overrides theme.palette.fg
    primaryColor?: string // Overrides theme.palette.primary
    mutedColor?: string // Overrides theme.palette.muted
  }
  customFonts?: {
    titleFont?: string // Overrides theme.fonts.title
    bodyFont?: string // Overrides theme.fonts.body
  }
  // New tile-based structure
  tiles?: Tile[]
  // Legacy structure (for backward compatibility)
  hero?: {
    background?: BackgroundImage | {
      type: 'video' | 'gradient'
      src?: string
      gradientFrom?: string
      gradientTo?: string
      parallax?: boolean
    }
    eventType?: string
    title: string
    subtitle?: string
    showTimer: boolean
    eventDate?: string // ISO string
    buttons: Array<{
      label: 'Save the Date' | 'RSVP' | 'Registry'
      action: 'calendar' | 'rsvp' | 'registry'
      href?: string
    }>
  }
  descriptionMarkdown?: string
  location?: {
    name?: string
    address?: string
    lat?: number
    lng?: number
  }
}

export interface InvitePage {
  id: number
  event: number
  event_slug: string
  slug: string
  background_url: string
  config: InviteConfig
  is_published: boolean
  created_at: string
  updated_at: string
}

