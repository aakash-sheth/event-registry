/**
 * Available font families for invitation pages
 * Includes both Google Fonts (for backward compatibility) and system fonts
 */

export interface FontOption {
  id: string
  name: string
  family: string
  category: 'serif' | 'sans-serif' | 'script' | 'display'
}

export const FONT_OPTIONS: FontOption[] = [
  // System fonts (from RichTextEditor) - added first for consistency
  // Sans-serif fonts
  {
    id: 'helvetica',
    name: 'Helvetica',
    family: 'Helvetica, Arial, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'arial',
    name: 'Arial',
    family: 'Arial, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'verdana',
    name: 'Verdana',
    family: 'Verdana, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'trebuchet-ms',
    name: 'Trebuchet MS',
    family: 'Trebuchet MS, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'courier-new',
    name: 'Courier New',
    family: 'Courier New, monospace',
    category: 'sans-serif', // Monospace but categorized as sans-serif
  },
  // Serif fonts
  {
    id: 'times-new-roman',
    name: 'Times New Roman',
    family: 'Times New Roman, serif',
    category: 'serif',
  },
  {
    id: 'georgia',
    name: 'Georgia',
    family: 'Georgia, serif',
    category: 'serif',
  },
  {
    id: 'palatino',
    name: 'Palatino',
    family: 'Palatino, serif',
    category: 'serif',
  },
  // Script fonts
  {
    id: 'comic-sans-ms',
    name: 'Comic Sans MS',
    family: 'Comic Sans MS, cursive',
    category: 'script',
  },
  // Display fonts
  {
    id: 'impact',
    name: 'Impact',
    family: 'Impact, fantasy',
    category: 'display',
  },
  // Google Fonts (for backward compatibility with existing invites)
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

/**
 * Get font family string by ID
 */
export function getFontFamily(id: string): string {
  const font = FONT_OPTIONS.find((f) => f.id === id)
  return font?.family || FONT_OPTIONS[0].family
}

/**
 * Find font option by family string (for backward compatibility)
 * This allows finding fonts even when the exact family string format differs slightly
 */
export function findFontByFamily(family: string | undefined | null): FontOption | undefined {
  if (!family) return undefined
  
  // Normalize the family string for comparison (remove extra spaces, quotes)
  const normalize = (str: string) => 
    str.toLowerCase().replace(/['"]/g, '').replace(/\s+/g, ' ').trim()
  
  const normalizedFamily = normalize(family)
  
  // First try exact match
  let font = FONT_OPTIONS.find(f => normalize(f.family) === normalizedFamily)
  if (font) return font
  
  // Try matching by first font name (e.g., "Playfair Display" from "'Playfair Display', serif")
  const firstFontName = normalizedFamily.split(',')[0].trim()
  font = FONT_OPTIONS.find(f => {
    const fontName = normalize(f.family).split(',')[0].trim()
    return fontName === firstFontName
  })
  
  return font
}
