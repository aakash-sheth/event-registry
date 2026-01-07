/**
 * Map URL validation and conversion utilities
 */

import type { EventDetailsTileSettings } from './schema'

/**
 * Generate a Google Maps search URL from a location string
 * This creates a simple search URL that works without API keys
 */
export function generateMapUrlFromLocation(location: string): string {
  if (!location || !location.trim()) return ''
  
  // Create a Google Maps search URL
  // Format: https://www.google.com/maps?q=LOCATION
  const encodedLocation = encodeURIComponent(location.trim())
  return `https://www.google.com/maps?q=${encodedLocation}`
}

/**
 * Generate a Google Maps URL from coordinates
 * This creates a precise location URL using latitude and longitude
 */
export function generateMapUrlFromCoordinates(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/**
 * Extract URL from iframe code if present
 * Returns the URL if found, otherwise returns the input as-is
 */
export function extractUrlFromIframe(input: string): string {
  if (!input || !input.trim()) return input
  
  // Try to extract src from iframe tag
  const iframeMatch = input.match(/<iframe[^>]+src=["']([^"']+)["']/i)
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1].trim()
  }
  
  // Try to extract from src= without quotes
  const srcMatch = input.match(/src=([^\s>]+)/i)
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1].trim()
  }
  
  return input.trim()
}

/**
 * Check if a URL is a valid map service URL
 */
export function isValidMapUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return false
  
  // First, try to extract URL from iframe code if present
  const extractedUrl = extractUrlFromIframe(url)
  
  try {
    const urlObj = new URL(extractedUrl)
    const hostname = urlObj.hostname.toLowerCase()
    const pathname = urlObj.pathname.toLowerCase()
    
    // Check if it's a valid map service
    return (
      // Google Maps full URLs
      (hostname.includes('google.com') && (pathname.includes('/maps') || urlObj.searchParams.has('q'))) ||
      hostname.includes('maps.google.com') ||
      // Google Maps embed URLs
      (hostname.includes('google.com') && pathname.includes('/embed')) ||
      // Google Maps short links (goo.gl)
      hostname === 'maps.app.goo.gl' ||
      hostname === 'goo.gl' ||
      // Apple Maps
      hostname.includes('maps.apple.com')
    )
  } catch {
    return false
  }
}

/**
 * Convert map URL to embeddable format
 * Returns null if URL cannot be embedded
 * Can also accept coordinates directly for more accurate embedding
 * @param mapUrl - The map URL or address text
 * @param coordinates - Optional precise coordinates (lat, lng)
 * @param zoom - Optional zoom level (unused, always uses street level 19)
 */
export function getEmbedUrl(
  mapUrl: string, 
  coordinates?: { lat: number, lng: number },
  zoom?: number
): string | null {
  const zoomLevel = 19 // Always use street level (19-20) for optimal detail - shows individual buildings
  
  // Prioritize coordinates if provided (most accurate)
  if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
    return `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=${zoomLevel}&output=embed`
  }
  
  if (!mapUrl || !mapUrl.trim()) return null
  
  // Extract URL from iframe code if present
  const extractedUrl = extractUrlFromIframe(mapUrl)
  
  try {
    const url = new URL(extractedUrl)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname.toLowerCase()
    
    // Handle Google Maps short links - these need to be resolved first
    if (hostname === 'maps.app.goo.gl' || hostname === 'goo.gl') {
      // Short links cannot be directly embedded without resolving
      // Return null to indicate it's not directly embeddable
      return null
    }
    
    // Google Maps - convert to embed format
    if (hostname.includes('google.com') || hostname.includes('maps.google.com')) {
      // Extract location information from various URL formats
      let locationQuery: string | null = null
      
      // Try to get location from q parameter first
      const q = url.searchParams.get('q')
      if (q) {
        // Check if q parameter contains coordinates (lat,lng format)
        const coordMatch = q.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/)
        if (coordMatch) {
          locationQuery = q // Use coordinates directly
        } else {
          locationQuery = q // Use as address/place name
        }
      }
      
      // If no q parameter, try to extract from pathname (e.g., /maps/place/...)
      if (!locationQuery) {
        const placeMatch = url.pathname.match(/\/place\/([^/]+)/)
        if (placeMatch) {
          locationQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        }
      }
      
      // If still no location, try ll parameter (lat,lng)
      if (!locationQuery) {
        const ll = url.searchParams.get('ll')
        if (ll) {
          locationQuery = ll
        }
      }
      
      // If we found a location, rebuild URL with forced zoom level
      if (locationQuery) {
        // Check if it's coordinates
        const coordMatch = locationQuery.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/)
        if (coordMatch) {
          // Coordinates - use directly
          return `https://www.google.com/maps?q=${locationQuery}&z=${zoomLevel}&output=embed`
        } else {
          // Address/place name - encode it
          return `https://www.google.com/maps?q=${encodeURIComponent(locationQuery)}&z=${zoomLevel}&output=embed`
        }
      }
      
      // If already embed format but we couldn't extract location, try to force zoom
      if (pathname.includes('/embed')) {
        // Remove viewport parameters that might override zoom
        url.searchParams.delete('ll')
        url.searchParams.delete('spn') // span/viewport
        url.searchParams.delete('t') // map type
        // Force zoom level
        url.searchParams.set('z', zoomLevel.toString())
        // Ensure output=embed is set
        url.searchParams.set('output', 'embed')
        return url.toString()
      }
    }
    
    // Apple Maps - not easily embeddable
    if (hostname.includes('maps.apple.com')) {
      return null // Apple Maps doesn't support embedding
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(coordinates?: { lat: number, lng: number }): boolean {
  if (!coordinates) return false
  const { lat, lng } = coordinates
  return (
    typeof lat === 'number' && 
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !isNaN(lat) && !isNaN(lng)
  )
}

/**
 * Check if input is a URL (starts with http:// or https://)
 */
export function isUrl(input: string): boolean {
  if (!input || !input.trim()) return false
  const trimmed = input.trim().toLowerCase()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

/**
 * Validate and auto-verify map location
 * Returns updated settings with locationVerified set automatically
 */
export function validateAndVerifyMapLocation(settings: EventDetailsTileSettings): EventDetailsTileSettings {
  let verified = false
  let finalMapUrl = settings.mapUrl
  
  // Priority: Coordinates > Map URL > Map URL as address text
  if (settings.coordinates && isValidCoordinates(settings.coordinates)) {
    // Coordinates are valid - auto-verify
    verified = true
    // Generate URL from coordinates if mapUrl doesn't exist
    if (!finalMapUrl) {
      finalMapUrl = generateMapUrlFromCoordinates(settings.coordinates.lat, settings.coordinates.lng)
    }
  } else if (settings.mapUrl && settings.mapUrl.trim()) {
    const mapInput = settings.mapUrl.trim()
    
    // First, try to extract URL from iframe code if present
    const extractedUrl = extractUrlFromIframe(mapInput)
    
    if (isUrl(extractedUrl)) {
      // It's a URL (or extracted from iframe) - validate format
      verified = isValidMapUrl(extractedUrl)
      if (verified) {
        // Use the extracted/cleaned URL
        finalMapUrl = extractedUrl
      }
    } else {
      // It's address text - generate URL and validate format
      const generatedUrl = generateMapUrlFromLocation(mapInput)
      if (generatedUrl && isValidMapUrl(generatedUrl)) {
        verified = true
        finalMapUrl = generatedUrl
      }
    }
  }
  
  return {
    ...settings,
    mapUrl: finalMapUrl,
    locationVerified: verified
  }
}

/**
 * Check if map can be displayed based on verification status
 * Returns true if location is verified OR coordinates exist
 */
export function canShowMap(settings: EventDetailsTileSettings): boolean {
  const isLocationVerified = settings.locationVerified === true || 
                              settings.coordinates !== undefined
  
  // Map data can come from mapUrl or coordinates
  const hasMapData = settings.mapUrl || 
                     settings.coordinates
  
  return isLocationVerified && !!hasMapData
}

