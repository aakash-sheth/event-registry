/**
 * Available font families for Living Poster
 */

export interface FontOption {
  id: string
  name: string
  family: string
  category: 'serif' | 'sans-serif' | 'script' | 'display'
}

export const FONT_OPTIONS: FontOption[] = [
  // Serif fonts
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    family: "'Playfair Display', serif",
    category: 'serif',
  },
  {
    id: 'cormorant-garamond',
    name: 'Cormorant Garamond',
    family: "'Cormorant Garamond', serif",
    category: 'serif',
  },
  {
    id: 'lora',
    name: 'Lora',
    family: "'Lora', serif",
    category: 'serif',
  },
  // Sans-serif fonts
  {
    id: 'inter',
    name: 'Inter',
    family: 'Inter, system-ui, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    family: "'Poppins', sans-serif",
    category: 'sans-serif',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    family: "'Open Sans', sans-serif",
    category: 'sans-serif',
  },
  // Script fonts
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    family: "'Great Vibes', cursive",
    category: 'script',
  },
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    family: "'Dancing Script', cursive",
    category: 'script',
  },
  {
    id: 'pacifico',
    name: 'Pacifico',
    family: "'Pacifico', cursive",
    category: 'script',
  },
  // Display fonts
  {
    id: 'montserrat',
    name: 'Montserrat',
    family: "'Montserrat', sans-serif",
    category: 'display',
  },
  {
    id: 'raleway',
    name: 'Raleway',
    family: "'Raleway', sans-serif",
    category: 'display',
  },
]

export function getFontFamily(id: string): string {
  const font = FONT_OPTIONS.find((f) => f.id === id)
  return font?.family || FONT_OPTIONS[0].family
}

