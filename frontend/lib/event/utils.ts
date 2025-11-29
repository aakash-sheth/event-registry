/**
 * Event utility functions
 */

interface Event {
  date?: string
  city?: string
  page_config?: {
    tiles?: Array<{
      type: string
      enabled?: boolean
      settings?: any
    }>
  }
}

/**
 * Get event details from page_config.tiles (event-details tile) with fallback to event model fields
 * This makes the invitation design the source of truth for event date and location
 */
export function getEventDetailsFromConfig(event: Event | null): { date: string | undefined; location: string | undefined } {
  if (!event) {
    return { date: undefined, location: undefined }
  }

  // Check if page_config has event-details tile
  if (event.page_config?.tiles) {
    const eventDetailsTile = event.page_config.tiles.find(
      (tile: any) => tile.type === 'event-details' && tile.enabled !== false
    ) as any

    if (eventDetailsTile?.settings) {
      return {
        date: eventDetailsTile.settings.date || event.date,
        location: eventDetailsTile.settings.location || event.city,
      }
    }
  }

  // Fallback to event model fields
  return {
    date: event.date,
    location: event.city,
  }
}

