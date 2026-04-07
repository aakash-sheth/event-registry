import { NextRequest, NextResponse } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
  const siteUrl = getSiteUrl()

  try {
    const response = await fetch(`${apiBase}/q/${token}/`, {
      redirect: 'manual',
      headers: {
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'User-Agent': request.headers.get('user-agent') || '',
        'Referer': request.headers.get('referer') || '',
      },
    })

    const location = response.headers.get('location')
    if (location && response.status >= 300 && response.status < 400) {
      const destination = location.startsWith('http')
        ? location
        : `${siteUrl}${location.startsWith('/') ? location : '/' + location}`
      return NextResponse.redirect(destination, { status: 302 })
    }

    return NextResponse.redirect(new URL('/', request.url))
  } catch {
    return NextResponse.redirect(new URL('/', request.url))
  }
}
