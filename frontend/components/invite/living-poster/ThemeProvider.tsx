'use client'

import React, { createContext, useContext } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { getTheme } from '@/lib/invite/themes'

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
  // When customColors/customFonts are not set, derive from themeId so template themes display correctly
  const theme = getTheme(config?.themeId || 'classic-noir')
  const colors: ColorsAndFonts = {
    backgroundColor: config?.customColors?.backgroundColor ?? theme.palette.bg,
    fontColor: config?.customColors?.fontColor ?? theme.palette.fg,
    primaryColor: config?.customColors?.primaryColor ?? theme.palette.primary,
    mutedColor: config?.customColors?.mutedColor ?? theme.palette.muted,
    titleFont: config?.customFonts?.titleFont ?? theme.fonts.title,
    bodyFont: config?.customFonts?.bodyFont ?? theme.fonts.body,
    overlayOpacity: theme.palette.overlayOpacity ?? 0.25,
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

