'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  PlusCircle,
  User,
  LogOut,
} from 'lucide-react'
import Logo from '@/components/Logo'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const AUTH_ROUTES = new Set([
  '/host/login',
  '/host/signup',
  '/host/forgot-password',
  '/host/reset-password',
])

function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) {
    return pathname === href
  }
  if (href === '/host/dashboard') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getEventIdFromPath(pathname: string): string | null {
  const eventRouteMatch = pathname.match(/^\/host\/events\/(\d+)(?:\/|$)/)
  if (eventRouteMatch) {
    return eventRouteMatch[1]
  }

  const registryRouteMatch = pathname.match(/^\/host\/items\/(\d+)(?:\/|$)/)
  if (registryRouteMatch) {
    return registryRouteMatch[1]
  }

  return null
}

export default function HostShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isDesktopNavCollapsed, setIsDesktopNavCollapsed] = useState(false)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [eventSettings, setEventSettings] = useState<{
    has_rsvp: boolean
    has_registry: boolean
    event_structure: 'SIMPLE' | 'ENVELOPE'
  } | null>(null)

  const isAuthRoute = AUTH_ROUTES.has(pathname)
  const eventId = getEventIdFromPath(pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  const globalNavItems = useMemo(
    () => [
      {
        href: '/host/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
      },
      {
        href: '/host/events/new',
        label: 'Create Event',
        icon: PlusCircle,
      },
      {
        href: '/host/profile',
        label: 'Profile',
        icon: User,
      },
    ],
    []
  )

  const eventNavItems = useMemo(() => {
    if (!eventId) return []
    const hasRsvp = eventSettings?.has_rsvp ?? true
    const hasRegistry = eventSettings?.has_registry ?? true
    const isEnvelope = eventSettings?.event_structure === 'ENVELOPE'
    const items: { href: string; label: string }[] = [
      { href: `/host/events/${eventId}`, label: 'Overview' },
      { href: `/host/events/${eventId}/design`, label: 'Design' },
      { href: `/host/events/${eventId}/guests`, label: 'Guests' },
    ]
    if (hasRsvp) items.push({ href: `/host/events/${eventId}/rsvp`, label: 'RSVP' })
    if (isEnvelope) items.push({ href: `/host/events/${eventId}/sub-events`, label: 'Sub-Events' })
    items.push({ href: `/host/events/${eventId}/communications`, label: 'Communications' })
    if (hasRegistry) items.push({ href: `/host/items/${eventId}`, label: 'Registry' })

    return items
  }, [eventId, eventSettings])

  useEffect(() => {
    if (!eventId) {
      setEventSettings(null)
      return
    }

    let isCancelled = false
    const fetchEvent = async () => {
      try {
        const response = await api.get(`/api/events/${eventId}/`)
        if (!isCancelled && response.data) {
          setEventSettings({
            has_rsvp: response.data.has_rsvp ?? true,
            has_registry: response.data.has_registry ?? true,
            event_structure: response.data.event_structure || 'SIMPLE',
          })
        }
      } catch {
        if (!isCancelled) setEventSettings(null)
      }
    }

    fetchEvent()
    return () => {
      isCancelled = true
    }
  }, [eventId])

  if (isAuthRoute) {
    return <>{children}</>
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    router.push('/host/login')
  }

  return (
    <div className="min-h-screen bg-eco-beige md:flex">
      {isMobileDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-white border-r border-eco-green-light shadow-sm transition-all md:static md:translate-x-0',
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full',
          isDesktopNavCollapsed ? 'md:w-20' : 'md:w-64',
          'w-72'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-eco-green-light px-4 py-4">
            <Logo href="/host/dashboard" textClassName={cn(isDesktopNavCollapsed && 'md:hidden')} />
            <button
              type="button"
              className="hidden rounded-md p-1 text-eco-green hover:bg-eco-green-light md:inline-flex"
              aria-label={isDesktopNavCollapsed ? 'Expand navigation panel' : 'Collapse navigation panel'}
              onClick={() => setIsDesktopNavCollapsed((previous) => !previous)}
            >
              {isDesktopNavCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {globalNavItems.map((item) => {
              const isActive = isActivePath(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-eco-green text-white' : 'text-gray-700 hover:bg-eco-green-light',
                    isDesktopNavCollapsed && 'md:justify-center md:px-0'
                  )}
                  onClick={() => setIsMobileDrawerOpen(false)}
                >
                  <Icon size={18} />
                  <span className={cn(isDesktopNavCollapsed && 'md:hidden')}>{item.label}</span>
                </Link>
              )
            })}

            {mounted && eventId && eventNavItems.length > 0 && (
              <>
                <div className={cn('my-3 border-t border-eco-green-light', isDesktopNavCollapsed && 'md:hidden')} />
                <p
                  className={cn(
                    'px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500',
                    isDesktopNavCollapsed && 'md:hidden'
                  )}
                >
                  Event
                </p>
                {eventNavItems.map((item) => {
                  const isEventRootLink = item.href === `/host/events/${eventId}`
                  const isActive = isActivePath(pathname, item.href, isEventRootLink)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-eco-green text-white'
                          : 'text-gray-700 hover:bg-eco-green-light hover:text-eco-green',
                        isDesktopNavCollapsed && 'md:hidden'
                      )}
                      onClick={() => setIsMobileDrawerOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}
          </nav>

          <div className="border-t border-eco-green-light p-3">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-eco-green-light',
                isDesktopNavCollapsed && 'md:justify-center md:px-0'
              )}
              onClick={handleLogout}
            >
              <LogOut size={18} />
              <span className={cn(isDesktopNavCollapsed && 'md:hidden')}>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-eco-green-light bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md p-2 text-eco-green hover:bg-eco-green-light md:hidden"
                aria-label="Open navigation menu"
                onClick={() => setIsMobileDrawerOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-eco-green">Host Workspace</span>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
