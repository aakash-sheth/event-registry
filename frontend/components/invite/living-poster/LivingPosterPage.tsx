'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { InviteConfig } from '@/lib/invite/schema'
import { ThemeProvider, useTheme } from './ThemeProvider'
import Hero from './Hero'
import Description from './Description'
import TilePreview from '@/components/invite/tiles/TilePreview'
import ScrollIndicator from '@/components/invite/ScrollIndicator'
import TextureOverlay from './TextureOverlay'

const DEFAULT_VIEWPORT_FADE_INSET_PX = 10

/**
 * Opacity 0→1 as the tile moves out of the top/bottom viewport edge bands (inset px each).
 * Content overlapping the top band fades by top edge proximity; bottom band by bottom edge.
 */
function InviteTileViewportEdgeFade({
  children,
  enabled,
  insetPx,
}: {
  children: React.ReactNode
  enabled: boolean
  insetPx: number
}) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [opacity, setOpacity] = useState(1)

  useLayoutEffect(() => {
    if (!enabled || reduceMotion) {
      setOpacity(1)
      return
    }

    const inset = Math.max(1, insetPx)
    let raf = 0

    const tick = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || inset + 1

      const topFactor = rect.top >= inset ? 1 : Math.max(0, rect.top / inset)
      const bottomDist = vh - rect.bottom
      const bottomFactor = bottomDist >= inset ? 1 : Math.max(0, bottomDist / inset)

      const next = Math.min(1, topFactor * bottomFactor)
      setOpacity((prev) => (Math.abs(prev - next) < 0.004 ? prev : next))
    }

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        tick()
      })
    }

    tick()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled, reduceMotion, insetPx])

  if (!enabled || reduceMotion) {
    return <div className="w-full">{children}</div>
  }

  return (
    <div ref={ref} className="w-full will-change-[opacity]" style={{ opacity }}>
      {children}
    </div>
  )
}

interface LivingPosterPageProps {
  config: InviteConfig
  eventSlug: string
  eventDate?: string
  eventTimezone?: string
  showBadge?: boolean
  hasRsvp?: boolean
  hasRegistry?: boolean
  skipTextureOverlay?: boolean
  skipBackgroundColor?: boolean
  allowedSubEvents?: any[]
  guestToken?: string | null
  rsvpCount?: number
}

function LivingPosterContent({
  config,
  eventSlug,
  eventDate,
  eventTimezone,
  showBadge = true,
  hasRsvp = false,
  hasRegistry = false,
  skipTextureOverlay = false,
  skipBackgroundColor = false,
  allowedSubEvents = [],
  guestToken,
  rsvpCount,
}: LivingPosterPageProps) {
  const theme = useTheme()
  const backgroundColor = config.customColors?.backgroundColor ?? theme.backgroundColor
  const tileViewportFade = config.animations?.tileViewportFade === true
  const tileFadeInset =
    typeof config.animations?.tileViewportFadeInsetPx === 'number' &&
    config.animations.tileViewportFadeInsetPx > 0
      ? config.animations.tileViewportFadeInsetPx
      : DEFAULT_VIEWPORT_FADE_INSET_PX

  // Set body background to match page background (skip if already set at page level)
  useEffect(() => {
    if (skipBackgroundColor) {
      return
    }
    // Use setProperty with important flag to override CSS rules from globals.css
    document.body.style.setProperty('background-color', backgroundColor, 'important')
    document.documentElement.style.setProperty('background-color', backgroundColor, 'important')
    // Also set background (not just background-color) to override CSS background property
    document.body.style.setProperty('background', backgroundColor, 'important')
    document.documentElement.style.setProperty('background', backgroundColor, 'important')

    return () => {
      // Reset on unmount (optional, but clean)
      document.body.style.removeProperty('background-color')
      document.body.style.removeProperty('background')
      document.documentElement.style.removeProperty('background-color')
      document.documentElement.style.removeProperty('background')
    }
  }, [backgroundColor, skipBackgroundColor])

  // If tiles exist, render tile-based layout
  if (config.tiles && config.tiles.length > 0) {
    const sortedTiles = [...config.tiles]
      .filter(tile => tile.enabled)
      .sort((a, b) => a.order - b.order)

    // DEBUG: Log order on invite page
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[TILE ORDER DEBUG] Invite page order:', {
        allTiles: config.tiles.map(t => ({
          id: t.id,
          type: t.type,
          enabled: t.enabled,
          order: t.order,
        })),
        enabledTiles: sortedTiles.map(t => ({
          id: t.id,
          type: t.type,
          order: t.order,
        })),
      })
    }

    const sharedProps = {
      eventDate,
      eventTimezone,
      eventSlug,
      hasRsvp,
      hasRegistry,
      allTiles: config.tiles || [],
      allowedSubEvents,
      guestToken,
    }

    return (
      <div className="w-full relative overflow-x-hidden" style={skipBackgroundColor ? {} : { backgroundColor, background: backgroundColor } as React.CSSProperties}>
        {!skipTextureOverlay && (
          <TextureOverlay
            type={config.texture?.type || 'none'}
            intensity={config.texture?.intensity || 40}
            imageUrl={config.texture?.imageUrl}
            textureBlend={config.texture?.textureBlend}
          />
        )}
        {config.cornerDecorations && (config.cornerDecorations.topLeft || config.cornerDecorations.topRight || config.cornerDecorations.bottomLeft || config.cornerDecorations.bottomRight) && (
          <div className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 2 }} aria-hidden>
            {config.cornerDecorations.topLeft && (
              <img src={config.cornerDecorations.topLeft} alt="" className="absolute left-0 top-0 w-24 h-24 md:w-32 md:h-32 object-contain object-left-top" />
            )}
            {config.cornerDecorations.topRight && (
              <img src={config.cornerDecorations.topRight} alt="" className="absolute right-0 top-0 w-24 h-24 md:w-32 md:h-32 object-contain object-right-top" />
            )}
            {config.cornerDecorations.bottomLeft && (
              <img src={config.cornerDecorations.bottomLeft} alt="" className="absolute left-0 bottom-0 w-24 h-24 md:w-32 md:h-32 object-contain object-left-bottom" />
            )}
            {config.cornerDecorations.bottomRight && (
              <img src={config.cornerDecorations.bottomRight} alt="" className="absolute right-0 bottom-0 w-24 h-24 md:w-32 md:h-32 object-contain object-right-bottom" />
            )}
          </div>
        )}
        <div
          className={
            config.spacing === 'tight'
              ? 'flex flex-col gap-4'
              : config.spacing === 'spacious'
                ? 'flex flex-col gap-12'
                : 'flex flex-col gap-8'
          }
        >
        {sortedTiles.map((tile) => {
          const tileEl = <TilePreview tile={tile} {...sharedProps} />

          // Inject attendee count above the RSVP/feature-buttons tile (min 5 to avoid "2 attending")
          if (tile.type === 'feature-buttons' && hasRsvp && rsvpCount !== undefined && rsvpCount >= 5) {
            const countColor = config.customColors?.fontColor ?? theme.fontColor
            return (
              <InviteTileViewportEdgeFade key={tile.id} enabled={tileViewportFade} insetPx={tileFadeInset}>
                <div className="flex flex-col gap-2 w-full">
                  <p className="text-center text-sm px-6" style={{ color: countColor, opacity: 0.6 }}>
                    ✓ {rsvpCount} {rsvpCount === 1 ? 'person' : 'people'} attending
                  </p>
                  {tileEl}
                </div>
              </InviteTileViewportEdgeFade>
            )
          }

          return (
            <InviteTileViewportEdgeFade key={tile.id} enabled={tileViewportFade} insetPx={tileFadeInset}>
              {tileEl}
            </InviteTileViewportEdgeFade>
          )
        })}
        </div>
        {config.pageFrame?.imageUrl && (
          <div
            className="absolute inset-0 pointer-events-none w-full h-full"
            style={{ zIndex: 5 }}
            aria-hidden
          >
            <img
              src={config.pageFrame.imageUrl}
              alt=""
              className="w-full h-full object-contain"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        )}
        <ScrollIndicator />
      </div>
    )
  }

  // Fallback to legacy hero/description layout
  return (
    <div className="relative" style={skipBackgroundColor ? {} : { backgroundColor, background: backgroundColor } as React.CSSProperties}>
      {!skipTextureOverlay && (
        <TextureOverlay
          type={config.texture?.type || 'none'}
          intensity={config.texture?.intensity || 40}
          imageUrl={config.texture?.imageUrl}
          textureBlend={config.texture?.textureBlend}
        />
      )}
      <Hero
        config={config}
        eventSlug={eventSlug}
        eventDate={eventDate}
        showBadge={showBadge}
        theme={theme}
        guestToken={guestToken}
      />
      {config.descriptionMarkdown && (
        <Description markdown={config.descriptionMarkdown} config={config} />
      )}
      <ScrollIndicator />
    </div>
  )
}

export default function LivingPosterPage(props: LivingPosterPageProps) {
  return (
    <ThemeProvider config={props.config}>
      <LivingPosterContent {...props} />
    </ThemeProvider>
  )
}

