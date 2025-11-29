import { NextRequest, NextResponse } from 'next/server'
import { generateICS } from '@/lib/calendar'

// Get API base URL for server-side fetching
// In Docker, use BACKEND_API_BASE (service name), otherwise use NEXT_PUBLIC_API_BASE
const API_BASE = process.env.BACKEND_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 })
  }

  try {
    // Fetch event data from API
    const response = await fetch(`${API_BASE}/api/registry/${slug}/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    
    const event = await response.json()

    if (!event || !event.date) {
      return NextResponse.json({ error: 'Event not found or missing date' }, { status: 404 })
    }

    // Parse event date and create end date (assume 4 hour duration)
    const startDate = new Date(event.date)
    const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000) // 4 hours later

    // Build location string
    const locationParts = []
    if (event.city) locationParts.push(event.city)
    if (event.country) locationParts.push(event.country)
    const location = locationParts.length > 0 ? locationParts.join(', ') : undefined

    // Generate ICS content
    const icsContent = generateICS({
      title: event.title || 'Event',
      details: event.description || undefined,
      location,
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
    })

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-event.ics"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to generate ICS:', error)
    return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 })
  }
}

