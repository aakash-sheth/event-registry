/**
 * WhatsApp sharing utilities
 * Generates Click-to-WhatsApp links that open WhatsApp with pre-filled messages
 */

/**
 * Generate WhatsApp share link for a phone number with a message
 * @param phone Phone number (with or without country code, will be cleaned)
 * @param message Message to pre-fill
 * @returns WhatsApp wa.me URL
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  // Clean phone number: remove +, spaces, dashes
  const cleanPhone = phone.replace(/\+|\s|-/g, '')
  
  // URL encode the message
  const encodedMessage = encodeURIComponent(message)
  
  // Generate wa.me link
  return `https://wa.me/${cleanPhone}/?text=${encodedMessage}`
}

/**
 * Generate WhatsApp share link for general sharing (no specific number)
 * Opens WhatsApp share dialog
 * @param message Message to pre-fill
 * @returns WhatsApp wa.me URL
 */
export function generateWhatsAppShareLink(message: string): string {
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/?text=${encodedMessage}`
}

/**
 * Open WhatsApp link in new window/tab
 * @param url WhatsApp URL
 */
export function openWhatsApp(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Safely replace template variables in a message
 * Only replaces known variables, leaves unknown ones as-is
 */
export function replaceTemplateVariables(
  template: string,
  variables: {
    name?: string
    event_title?: string
    event_date?: string | null
    event_location?: string
    event_url?: string
    host_name?: string
    map_direction?: string
    custom_fields?: Record<string, any>
  }
): string {
  let message = template
  
  // Define allowed variables and their replacements
  const replacements: Record<string, string> = {}
  const customFieldReplacements: Record<string, string> = {}
  
  if (variables.name !== undefined) {
    replacements['[name]'] = variables.name
  }
  
  if (variables.event_title !== undefined) {
    replacements['[event_title]'] = variables.event_title
  }
  
  if (variables.event_date !== undefined && variables.event_date !== null) {
    const dateStr = new Date(variables.event_date).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    replacements['[event_date]'] = dateStr
  } else if (variables.event_date === null) {
    replacements['[event_date]'] = 'TBD'
  }
  
  if (variables.event_location !== undefined) {
    replacements['[event_location]'] = variables.event_location
  }
  
  if (variables.event_url !== undefined) {
    replacements['[event_url]'] = variables.event_url
  }
  
  if (variables.host_name !== undefined) {
    replacements['[host_name]'] = variables.host_name
  }
  
  // Generate map direction link if location is available
  if (variables.map_direction !== undefined) {
    replacements['[map_direction]'] = variables.map_direction
  } else if (variables.event_location) {
    // Auto-generate Google Maps link if location is provided but map_direction is not
    const encodedLocation = encodeURIComponent(variables.event_location)
    replacements['[map_direction]'] = `https://maps.google.com/?q=${encodedLocation}`
  }

  // Custom fields from CSV / guest profile (e.g. [allergies], [table_number])
  // Normalize keys so "Test" becomes "test" and spaces become underscores.
  const normalizeCustomKey = (raw: string) => {
    return String(raw || '')
      .toLowerCase()
      .trim()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 50)
  }
  const reserved = new Set([
    'name',
    'event_title',
    'event_date',
    'event_location',
    'event_url',
    'host_name',
    'map_direction',
  ])

  if (variables.custom_fields && typeof variables.custom_fields === 'object') {
    Object.entries(variables.custom_fields).forEach(([rawKey, rawVal]) => {
      const key = normalizeCustomKey(rawKey)
      if (!key || reserved.has(key)) return
      const val = rawVal === null || rawVal === undefined ? '' : String(rawVal).trim()
      // Replace empty values with '—' so the template doesn't show the literal variable
      customFieldReplacements[`[${key}]`] = val || '—'
    })
  }
  
  // Replace all known variables
  Object.entries(replacements).forEach(([variable, value]) => {
    message = message.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
  })

  // Replace custom field variables (case-insensitive so [Test] also works for key "test")
  Object.entries(customFieldReplacements).forEach(([variable, value]) => {
    message = message.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), value)
  })
  
  return message
}

/**
 * Generate default event message template
 */
export function generateEventMessage(
  eventTitle: string,
  eventDate: string | null,
  eventUrl: string,
  hostName?: string,
  customTemplate?: string
): string {
  // If custom template is provided, use it
  if (customTemplate && customTemplate.trim()) {
    return replaceTemplateVariables(customTemplate, {
      name: '', // No guest name for general message
      event_title: eventTitle,
      event_date: eventDate,
      event_location: '',
      event_url: eventUrl,
      host_name: hostName,
    })
  }
  
  // Default template
  const dateStr = eventDate 
    ? new Date(eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD'
  
  const hostSignature = hostName ? `\n\n- ${hostName}` : ''
  
  return `Hey! 💛\n\nJust wanted to share ${eventTitle} on ${dateStr}!\n\nPlease confirm here: ${eventUrl}${hostSignature}`
}

/**
 * Generate personalized message for a guest
 */
export function generateGuestMessage(
  guestName: string,
  eventTitle: string,
  eventDate: string | null,
  eventUrl: string,
  hostName?: string,
  eventLocation?: string,
  customTemplate?: string
): string {
  // If custom template is provided, use it
  if (customTemplate && customTemplate.trim()) {
    // Generate map direction link if location is available
    let mapDirection: string | undefined
    if (eventLocation) {
      const encodedLocation = encodeURIComponent(eventLocation)
      mapDirection = `https://maps.google.com/?q=${encodedLocation}`
    }
    
    return replaceTemplateVariables(customTemplate, {
      name: guestName,
      event_title: eventTitle,
      event_date: eventDate,
      event_location: eventLocation || '',
      event_url: eventUrl,
      host_name: hostName,
      map_direction: mapDirection,
    })
  }
  
  // Default template
  const dateStr = eventDate 
    ? new Date(eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD'
  
  const hostSignature = hostName ? `\n\n- ${hostName}` : ''
  
  return `Hey ${guestName}! 💛\n\nJust wanted to share ${eventTitle} on ${dateStr}!\n\nPlease confirm here: ${eventUrl}${hostSignature}`
}

