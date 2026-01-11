/**
 * Color utility functions for automatic label color calculation
 * Uses relative brightness scale: labels are 5 tones away from font color
 */

/**
 * Convert hex color to RGB values
 * @param hex - Hex color string (e.g., "#1F2937" or "1F2937")
 * @returns RGB object or null if invalid
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return null
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return { r, g, b }
}

/**
 * Calculate brightness percentage (0-100%)
 * Uses relative luminance formula: (0.299*R + 0.587*G + 0.114*B) / 255 * 100
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Brightness percentage (0-100)
 */
export function getBrightnessPercentage(r: number, g: number, b: number): number {
  // Relative luminance formula (weighted average)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance * 100
}

/**
 * Adjust color brightness by N tones
 * Preserves color hue by adjusting all RGB components proportionally
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param tones - Number of tones to adjust (5 in our case)
 * @param lighten - If true, lighten the color; if false, darken it
 * @returns Adjusted RGB object
 */
export function adjustBrightness(
  r: number,
  g: number,
  b: number,
  tones: number,
  lighten: boolean
): { r: number; g: number; b: number } {
  // Calculate brightness adjustment amount
  // 5 tones ≈ 12-15% brightness change (approximately 30-40 points on 0-255 scale)
  const adjustmentAmount = Math.round((tones / 5) * 40) // ~40 points for 5 tones
  
  if (lighten) {
    // Lighten: increase RGB values
    return {
      r: Math.min(255, r + adjustmentAmount),
      g: Math.min(255, g + adjustmentAmount),
      b: Math.min(255, b + adjustmentAmount),
    }
  } else {
    // Darken: decrease RGB values
    return {
      r: Math.max(0, r - adjustmentAmount),
      g: Math.max(0, g - adjustmentAmount),
      b: Math.max(0, b - adjustmentAmount),
    }
  }
}

/**
 * Convert RGB values to hex color string
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hex color string (e.g., "#1F2937")
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => {
    const hex = Math.round(value).toString(16).padStart(2, '0')
    return hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Get automatic label color based on font color using relative brightness scale
 * - If font brightness is 0-50% (darker side): Add 5 tones (make label lighter)
 * - If font brightness is >50-100% (lighter side): Subtract 5 tones (make label darker)
 * - No font color set → default medium gray
 * 
 * @param fontColor - Font color hex string (e.g., "#1F2937") or undefined
 * @returns Label color hex string
 */
export function getAutomaticLabelColor(fontColor: string | undefined): string {
  // Default label color if no font color is set
  if (!fontColor) {
    return '#6B7280' // Medium gray (gray-500)
  }
  
  // Convert hex to RGB
  const rgb = hexToRgb(fontColor)
  if (!rgb) {
    // Invalid hex format, return default
    return '#6B7280'
  }
  
  // Calculate brightness percentage
  const brightness = getBrightnessPercentage(rgb.r, rgb.g, rgb.b)
  
  // Determine if we should lighten or darken
  const shouldLighten = brightness <= 50 // 0-50% = darker side, lighten labels
  const shouldDarken = brightness > 50 // >50-100% = lighter side, darken labels
  
  // Adjust brightness by 5 tones
  const adjustedRgb = adjustBrightness(rgb.r, rgb.g, rgb.b, 5, shouldLighten)
  
  // Convert back to hex
  return rgbToHex(adjustedRgb.r, adjustedRgb.g, adjustedRgb.b)
}





