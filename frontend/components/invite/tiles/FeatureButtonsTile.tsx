'use client'

import React from 'react'
import { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import Link from 'next/link'

export interface FeatureButtonsTileProps {
  settings: FeatureButtonsTileSettings
  preview?: boolean
  hasRsvp?: boolean
  hasRegistry?: boolean
  eventSlug?: string
  guestToken?: string | null
}

// CSS injected once per render for variants that need pseudo-elements / keyframes
const BUTTON_CSS = `
  /* ── Shimmer: border-beam light crawling clockwise around the edge ── */
  /*
   * Technique: ::before sits 2px OUTSIDE the button at z-index:-1.
   * The button's own background (z-index:0) covers the center of ::before,
   * leaving only the 2px outer ring visible — that ring carries the
   * rotating conic-gradient bright spot.
   */
  .fern-btn-shimmer {
    position: relative;
    z-index: 0;
    overflow: visible;
    transition: transform 0.15s ease, filter 0.15s ease;
  }
  .fern-btn-shimmer::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: conic-gradient(
      from 0deg,
      transparent    0deg,
      rgba(255,255,255,0.95) 10deg,
      rgba(255,255,255,0.55) 20deg,
      transparent   35deg,
      transparent  360deg
    );
    z-index: -1;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .fern-btn-shimmer:hover::before {
    opacity: 1;
    animation: fern-border-sweep 0.8s linear forwards;
  }
  .fern-btn-shimmer:active {
    transform: translateY(1px);
    filter: brightness(0.9);
  }
  @keyframes fern-border-sweep {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* ── Metal: diagonal face-sweep on hover (metallic sheen) ── */
  .fern-btn-metal {
    position: relative;
    overflow: hidden;
    transition: transform 0.15s ease, filter 0.15s ease;
  }
  .fern-btn-metal::before {
    content: '';
    position: absolute;
    top: -60%;
    left: -110%;
    width: 55%;
    height: 220%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.55) 50%,
      transparent 100%
    );
    transform: skewX(-18deg);
    pointer-events: none;
  }
  .fern-btn-metal:hover::before {
    animation: fern-metal-sweep 0.65s ease-in-out forwards;
  }
  .fern-btn-metal:active {
    filter: brightness(0.88);
  }
  @keyframes fern-metal-sweep {
    0%   { left: -110%; }
    100% { left: 130%; }
  }

  .fern-btn-ornate {
    transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
  }
  .fern-btn-ornate:hover {
    transform: translateY(-2px);
    filter: brightness(1.22);
    box-shadow:
      inset 0 1px 0 rgba(255,220,80,0.6),
      inset 0 -2px 0 rgba(0,0,0,0.45),
      inset 3px 0 6px rgba(0,0,0,0.18),
      inset -3px 0 6px rgba(0,0,0,0.18),
      0 10px 24px rgba(0,0,0,0.55),
      0 0 40px rgba(210,155,0,0.55),
      0 0 80px rgba(180,120,0,0.22) !important;
  }
  .fern-btn-ornate:active {
    transform: translateY(2px);
    filter: brightness(0.85);
    box-shadow:
      inset 0 3px 6px rgba(0,0,0,0.55),
      0 1px 3px rgba(0,0,0,0.4),
      0 0 10px rgba(160,110,0,0.2) !important;
  }
`

const RADIUS_MAP: Record<string, string> = {
  sharp:  '0px',
  subtle: '4px',
  round:  '8px',
  pill:   '9999px',
}

function getButtonStyles(
  buttonColor: string,
  variant: string,
  radius: string,
): { extraClass: string; style: React.CSSProperties } {
  const borderRadius = RADIUS_MAP[radius] ?? '8px'

  if (variant === 'link') {
    return {
      extraClass: 'font-semibold underline underline-offset-2',
      style: { color: buttonColor, background: 'none', padding: '4px 0', borderRadius: 0 },
    }
  }

  if (variant === 'classic') {
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
        border: '1px solid rgba(0,0,0,0.08)',
      },
    }
  }

  if (variant === 'gloss') {
    return {
      extraClass: 'font-semibold',
      style: {
        background: `linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.06) 100%), ${buttonColor}`,
        borderRadius,
        color: 'white',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 4px rgba(0,0,0,0.22)',
        border: '1px solid rgba(0,0,0,0.1)',
      },
    }
  }

  if (variant === 'soft') {
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)',
      },
    }
  }

  if (variant === 'metal') {
    return {
      extraClass: 'font-semibold fern-btn-metal',
      style: {
        background: `linear-gradient(160deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 45%, rgba(0,0,0,0.18) 100%), ${buttonColor}`,
        borderRadius,
        color: 'white',
        border: '1px solid rgba(0,0,0,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.2)',
      },
    }
  }

  if (variant === 'raised') {
    // Neo-brutalist hard offset shadow (Button 53 style) — bold, tactile, unmistakable
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        border: '2px solid rgba(0,0,0,0.85)',
        boxShadow: '5px 5px 0 rgba(0,0,0,0.82)',
      },
    }
  }

  if (variant === 'glow') {
    // Colored halo that pulses around the button matching its own color (Button 85 style)
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        boxShadow: `0 0 6px ${buttonColor}, 0 0 20px ${buttonColor}, 0 0 40px ${buttonColor}`,
      },
    }
  }

  if (variant === 'bracket') {
    // Corner-bracket marks only — elegant editorial style (Button 89 style)
    // Eight gradient segments draw two perpendicular lines at each corner
    const arm = '14px'
    const w = '2px'
    return {
      extraClass: 'font-semibold tracking-widest uppercase',
      style: {
        backgroundColor: 'transparent',
        backgroundImage: [
          `linear-gradient(to right, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to right, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to left,  ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to left,  ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to bottom, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to bottom, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to top,   ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to top,   ${buttonColor} 100%, transparent 0)`,
        ].join(', '),
        backgroundSize: [
          `${arm} ${w}`, `${arm} ${w}`, `${arm} ${w}`, `${arm} ${w}`,
          `${w} ${arm}`, `${w} ${arm}`, `${w} ${arm}`, `${w} ${arm}`,
        ].join(', '),
        backgroundPosition: '0 0, 0 100%, 100% 0, 100% 100%, 0 0, 100% 0, 0 100%, 100% 100%',
        backgroundRepeat: 'no-repeat',
        borderRadius: 0,
        color: buttonColor,
      },
    }
  }

  if (variant === 'shimmer') {
    // Solid button with bright rim lights on all edges + border-beam sweep on hover
    return {
      extraClass: 'font-semibold fern-btn-shimmer',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: [
          'inset 0 1px 0 rgba(255,255,255,0.55)',  // top rim highlight
          'inset 1px 0 0 rgba(255,255,255,0.18)',   // left rim
          'inset -1px 0 0 rgba(255,255,255,0.18)',  // right rim
          'inset 0 -1px 0 rgba(0,0,0,0.2)',         // bottom shadow
          '0 2px 8px rgba(0,0,0,0.2)',              // outer drop
        ].join(', '),
      },
    }
  }

  if (variant === 'ornate') {
    // Fantasy-game / Baldur's Gate: rich bronze gradient, golden text, ornate layered border
    return {
      extraClass: 'fern-btn-ornate tracking-widest',
      style: {
        background: 'linear-gradient(180deg, #9A7520 0%, #5C3D08 35%, #3A2500 55%, #7A5510 100%)',
        borderRadius,
        color: '#F0D060',
        border: '1px solid #C9A832',
        textShadow: '0 0 14px rgba(255,210,0,0.65), 0 1px 3px rgba(0,0,0,0.95)',
        letterSpacing: '0.12em',
        boxShadow: [
          'inset 0 1px 0 rgba(255,220,80,0.45)',
          'inset 0 -2px 0 rgba(0,0,0,0.55)',
          'inset 3px 0 6px rgba(0,0,0,0.25)',
          'inset -3px 0 6px rgba(0,0,0,0.25)',
          '0 4px 12px rgba(0,0,0,0.5)',
          '0 0 20px rgba(180,130,0,0.3)',
        ].join(', '),
      },
    }
  }

  // fallback
  return {
    extraClass: 'font-semibold',
    style: { backgroundColor: buttonColor, borderRadius, color: 'white' },
  }
}

export default function FeatureButtonsTile({
  settings,
  preview = false,
  hasRsvp = false,
  hasRegistry = false,
  eventSlug,
  guestToken,
}: FeatureButtonsTileProps) {
  const buttonColor = settings.buttonColor || 'var(--theme-primary, #D4A017)'
  const variant = settings.buttonVariant ?? 'classic'
  const radius  = settings.buttonRadius  ?? 'round'
  const { extraClass, style: btnStyle } = getButtonStyles(buttonColor, variant, radius)

  const buttons: Array<{ label: string; href: string }> = []

  if (hasRsvp) {
    buttons.push({
      label: settings.rsvpLabel || 'RSVP',
      href: guestToken ? `/event/${eventSlug}/rsvp?g=${guestToken}` : `/event/${eventSlug}/rsvp`
    })
  }
  if (hasRegistry) {
    buttons.push({
      label: settings.registryLabel || 'Registry',
      href: guestToken ? `/registry/${eventSlug}?gt=${guestToken}` : `/registry/${eventSlug}`
    })
  }

  const styleTag = <style dangerouslySetInnerHTML={{ __html: BUTTON_CSS }} />

  if (buttons.length === 0) {
    if (preview) return null
    return (
      <>
        {styleTag}
        <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
          <p className="text-gray-400 text-sm">No features enabled</p>
        </div>
      </>
    )
  }

  if (preview) {
    if (buttons.length === 1) {
      return (
        <>
          {styleTag}
          <div className="w-full py-8 px-4">
            <div className="flex justify-center">
              <Link
                href={buttons[0].href}
                className={`px-8 py-3 text-center ${extraClass}`}
                style={btnStyle}
              >
                {buttons[0].label}
              </Link>
            </div>
          </div>
        </>
      )
    }

    // Two buttons side by side
    return (
      <>
        {styleTag}
        <div className="w-full py-8 px-4">
          <div className="flex gap-4 justify-center">
            {buttons.map((button, idx) => (
              <Link
                key={idx}
                href={button.href}
                className={`flex-1 max-w-[200px] px-6 py-3 text-center ${extraClass}`}
                style={btnStyle}
              >
                {button.label}
              </Link>
            ))}
          </div>
        </div>
      </>
    )
  }

  // Settings preview
  return (
    <>
      {styleTag}
      <div className="w-full py-4 px-4 border rounded">
        <div className="flex gap-2 justify-center">
          {buttons.map((button, idx) => (
            <div
              key={idx}
              className={`px-4 py-2 text-sm ${extraClass}`}
              style={btnStyle}
            >
              {button.label}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
