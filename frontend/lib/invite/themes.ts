/**
 * Theme system for Living Poster invitations
 */

export type Theme = {
  id: string
  palette: {
    bg: string
    fg: string
    primary: string
    muted: string
    overlayOpacity: number
  }
  fonts: {
    title: string
    body: string
  }
}

export const THEMES: Theme[] = [
  {
    id: 'minimal-ivory',
    palette: {
      bg: '#F8F7F4',
      fg: '#121212',
      primary: '#0D6EFD',
      muted: '#6B7280',
      overlayOpacity: 0.25,
    },
    fonts: {
      title: "'Playfair Display', serif",
      body: 'Inter, system-ui',
    },
  },
  {
    id: 'classic-noir',
    palette: {
      bg: '#0E0F14',
      fg: '#FFFFFF',
      primary: '#E55A9E',
      muted: '#A7A8AD',
      overlayOpacity: 0.32,
    },
    fonts: {
      title: "'Great Vibes', cursive",
      body: 'Inter, system-ui',
    },
  },
  {
    id: 'emerald-mist',
    palette: {
      bg: '#0d1f1a',
      fg: '#FFFFFF',
      primary: '#34d399',
      muted: '#a7f3d0',
      overlayOpacity: 0.28,
    },
    fonts: {
      title: "'Cormorant Garamond', serif",
      body: 'Inter, system-ui',
    },
  },
]

export function getTheme(id: string): Theme {
  const theme = THEMES.find((t) => t.id === id)
  return theme || THEMES[0] // Default to first theme if not found
}

