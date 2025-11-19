'use client'

import React, { createContext, useContext } from 'react'
import { Theme } from '@/lib/invite/themes'
import { InviteConfig } from '@/lib/invite/schema'

interface ThemeContextType {
  theme: Theme
  effectiveTheme: Theme // Theme with custom overrides applied
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  theme: Theme
  config?: InviteConfig
  children: React.ReactNode
}

export function ThemeProvider({ theme, config, children }: ThemeProviderProps) {
  // Merge custom colors and fonts with theme
  // Ensure we check for backgroundColor even if customColors object exists but backgroundColor is undefined
  const customBg = config?.customColors?.backgroundColor
  const shouldUseCustomBg = customBg && customBg.trim() !== ''
  
  const effectiveTheme: Theme = {
    ...theme,
    palette: {
      ...theme.palette,
      bg: shouldUseCustomBg ? customBg : theme.palette.bg,
      fg: config?.customColors?.fontColor || theme.palette.fg,
      primary: config?.customColors?.primaryColor || theme.palette.primary,
      muted: config?.customColors?.mutedColor || theme.palette.muted,
    },
    fonts: {
      title: config?.customFonts?.titleFont || theme.fonts.title,
      body: config?.customFonts?.bodyFont || theme.fonts.body,
    },
  }

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme }}>
      <div
        style={{
          '--theme-bg': effectiveTheme.palette.bg,
          '--theme-fg': effectiveTheme.palette.fg,
          '--theme-primary': effectiveTheme.palette.primary,
          '--theme-muted': effectiveTheme.palette.muted,
          '--theme-overlay-opacity': effectiveTheme.palette.overlayOpacity,
          '--theme-font-title': effectiveTheme.fonts.title,
          '--theme-font-body': effectiveTheme.fonts.body,
        } as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context.effectiveTheme
}

