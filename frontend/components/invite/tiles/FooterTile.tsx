'use client'

import React from 'react'
import { FooterTileSettings } from '@/lib/invite/schema'

interface FooterTileProps {
  settings: FooterTileSettings
  preview?: boolean
}

export default function FooterTile({ settings, preview = false }: FooterTileProps) {
  if (!settings.text) {
    if (preview) return null
    return (
      <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
        <p className="text-gray-400 text-sm">No footer text</p>
      </div>
    )
  }

  if (preview) {
    return (
      <div className="w-full py-6 px-4 text-center border-t">
        <p className="text-sm text-gray-600">{settings.text}</p>
      </div>
    )
  }

  return (
    <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
      <p className="text-sm text-gray-600">{settings.text}</p>
    </div>
  )
}

