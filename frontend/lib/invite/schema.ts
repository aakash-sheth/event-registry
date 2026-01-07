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
export type TileType = 'title' | 'image' | 'timer' | 'event-details' | 'description' | 'feature-buttons' | 'footer' | 'event-carousel'

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
  location: string // Display text for location (flexible, e.g., "Grand Ballroom", "Beachside Venue")
  date: string // ISO date string
  time?: string // Time string (e.g., "18:00")
  dressCode?: string
  mapUrl?: string // Map location - accepts address text or Google Maps URL (auto-validated and verified)
  locationVerified?: boolean // Auto-set by system based on map location validation (true if valid, false if invalid)
  coordinates?: {
    lat: number
    lng: number
  } // Optional precise coordinates (auto-verifies when provided)
  showMap?: boolean // Option to display embedded map (only works if mapUrl is provided and valid and location is verified)
  fontColor?: string // Font color for event details text (hex color, e.g., "#000000")
  buttonColor?: string // Hex color for Save the Date button (e.g., "#1F2937")
  // Border styling options
  borderStyle?: 'elegant' | 'minimal' | 'ornate' | 'modern' | 'classic' | 'vintage' | 'none'
  borderColor?: string // Hex color for borders (default: based on borderStyle)
  borderWidth?: number // 1-4 pixels (default: 1)
  decorativeSymbol?: string // Custom symbol (❦, ✿, ✤, ✦, •, —, or empty)
  backgroundColor?: string // Background color for the tile (default: transparent or gray-50)
  borderRadius?: number // 0-24 pixels (default: 0 for preview, 4 for non-preview)
}

export interface DescriptionTileSettings {
  content: string // Rich text/markdown content
}

export interface FeatureButtonsTileSettings {
  buttonColor?: string // Hex color for buttons
  rsvpLabel?: string // Custom label for RSVP button (default: "RSVP")
  registryLabel?: string // Custom label for Registry button (default: "Registry")
}

export interface FooterTileSettings {
  text: string
}

export interface EventCarouselTileSettings {
  showFields: {
    image?: boolean
    title?: boolean
    dateTime?: boolean
    location?: boolean
    cta?: boolean
  }
  // Slideshow controls
  autoPlay?: boolean // Default: true
  autoPlayInterval?: number // Default: 5000, range: 3000-10000
  showArrows?: boolean // Default: true
  showDots?: boolean // Default: true
  // Card styling presets
  cardStyle?: 'minimal' | 'elegant' | 'modern' | 'classic' // Default: 'elegant'
  cardLayout?: 'full-width' | 'centered' | 'grid' // Default: 'centered'
  cardSpacing?: 'tight' | 'normal' | 'spacious' // Default: 'normal'
  // Card customization
  cardBackgroundColor?: string // Hex color, default: '#ffffff'
  cardBorderRadius?: number // 0-24, default: 12
  cardShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' // Default: 'md'
  cardBorderWidth?: number // 0-4, default: 0
  cardBorderColor?: string // Hex color
  cardBorderStyle?: 'solid' | 'dashed' // Default: 'solid'
  cardPadding?: 'tight' | 'normal' | 'spacious' // Default: 'normal'
  // Image settings
  imageHeight?: 'small' | 'medium' | 'large' | 'full' // Default: 'medium'
  imageAspectRatio?: '16:9' | '4:3' | '1:1' | 'auto' // Default: '16:9'
  // Global styling for sub-events (applies uniformly to all sub-events)
  subEventTitleStyling?: {
    font?: string // Font family from FONT_OPTIONS
    color?: string // Hex color
    size?: 'small' | 'medium' | 'large' | 'xlarge'
  }
  subEventDetailsStyling?: {
    fontColor?: string // Hex color for date/time and location text
  }
}

export type TextureType =
  | 'none'
  | 'paper-grain'
  | 'linen'
  | 'canvas'
  | 'parchment'
  | 'vintage-paper'
  | 'silk'
  | 'marble'

export interface TextureSettings {
  type: TextureType
  intensity?: number // 0-100, default 20
}

export type TileSettings = 
  | TitleTileSettings
  | ImageTileSettings
  | TimerTileSettings
  | EventDetailsTileSettings
  | DescriptionTileSettings
  | FeatureButtonsTileSettings
  | FooterTileSettings
  | EventCarouselTileSettings

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
  // Background texture (CSS-based)
  texture?: TextureSettings
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

