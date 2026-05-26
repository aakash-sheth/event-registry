'use client'

import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

export interface TitleTileProps {
  settings: TitleTileSettings
  preview?: boolean
}

export default function TitleTile({ settings, preview = false }: TitleTileProps) {
  const fontFamily = settings.font || FONT_OPTIONS[0].family
  const color = settings.color || '#000000'
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'

  // Size classes mapping
  const sizeClasses = {
    small: 'text-2xl md:text-3xl',
    medium: 'text-4xl md:text-5xl',
    large: 'text-5xl md:text-6xl',
    xlarge: 'text-6xl md:text-7xl',
  }

  const titleClassName = sizeClasses[size]
  const subtitle = settings.subtitle?.trim()
  const subtitleFont = settings.subtitleFont || FONT_OPTIONS[0].family
  const subtitleColor = settings.subtitleColor ?? color
  const subtitleSize = settings.subtitleSize || 'medium'
  const subtitleSizeClasses = {
    small: 'text-sm md:text-base',
    medium: 'text-base md:text-lg',
    large: 'text-lg md:text-xl',
  }

  if (preview) {
    return (
      <div className="w-full py-10 px-6 text-center flex flex-col items-center justify-center" style={{ fontFamily, color }}>
        <h1 className={`${titleClassName} font-light leading-tight tracking-wide text-center mx-auto`}>{text}</h1>
        {subtitle && (
          <p className={`${subtitleSizeClasses[subtitleSize]} mt-4 font-light tracking-widest uppercase text-center mx-auto max-w-xl opacity-80`} style={{ fontFamily: subtitleFont, color: subtitleColor }}>
            {subtitle}
          </p>
        )}
      </div>
    )
  }

  // Settings mode - just show a preview
  const previewSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xlarge: 'text-3xl',
  }
  return (
    <div className="w-full py-4 px-4 text-center border rounded" style={{ fontFamily, color }}>
      <h2 className={`${previewSizeClasses[size]} font-bold`}>{text || 'Event Title'}</h2>
      {subtitle && (
        <p className={`${subtitleSize === 'small' ? 'text-sm' : subtitleSize === 'large' ? 'text-base' : 'text-sm'} mt-2`} style={{ fontFamily: subtitleFont, color: subtitleColor }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
