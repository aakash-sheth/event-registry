'use client'

import React, { createContext, useContext } from 'react'
import { InviteConfig } from '@/lib/invite/schema'

// Default values when customColors/customFonts are not set
const DEFAULT_COLORS = {
  backgroundColor: '#ffffff',
  fontColor: '#000000',
  primaryColor: '#0D6EFD',
  mutedColor: '#6B7280',
}

const DEFAULT_FONTS = {
  titleFont: 'Inter, system-ui',
  bodyFont: 'Inter, system-ui',
}

const DEFAULT_OVERLAY_OPACITY = 0.25

export interface ColorsAndFonts {
  backgroundColor: string
  fontColor: string
  primaryColor: string
  mutedColor: string
  titleFont: string
  bodyFont: string
  overlayOpacity: number
}

interface ThemeContextType {
  colors: ColorsAndFonts
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  config?: InviteConfig
  children: React.ReactNode
}

export function ThemeProvider({ config, children }: ThemeProviderProps) {
  // Use customColors/customFonts directly, with defaults
  const colors: ColorsAndFonts = {
    backgroundColor: config?.customColors?.backgroundColor || DEFAULT_COLORS.backgroundColor,
    fontColor: config?.customColors?.fontColor || DEFAULT_COLORS.fontColor,
    primaryColor: config?.customColors?.primaryColor || DEFAULT_COLORS.primaryColor,
    mutedColor: config?.customColors?.mutedColor || DEFAULT_COLORS.mutedColor,
    titleFont: config?.customFonts?.titleFont || DEFAULT_FONTS.titleFont,
    bodyFont: config?.customFonts?.bodyFont || DEFAULT_FONTS.bodyFont,
    overlayOpacity: DEFAULT_OVERLAY_OPACITY,
  }

  return (
    <ThemeContext.Provider value={{ colors }}>
      <div
        style={{
          '--theme-bg': colors.backgroundColor,
          '--theme-fg': colors.fontColor,
          '--theme-primary': colors.primaryColor,
          '--theme-muted': colors.mutedColor,
          '--theme-overlay-opacity': colors.overlayOpacity,
          '--theme-font-title': colors.titleFont,
          '--theme-font-body': colors.bodyFont,
        } as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ColorsAndFonts {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context.colors
}

