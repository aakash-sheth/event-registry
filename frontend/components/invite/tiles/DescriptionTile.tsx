'use client'

import React from 'react'
import { DescriptionTileSettings } from '@/lib/invite/schema'

interface DescriptionTileProps {
  settings: DescriptionTileSettings
  preview?: boolean
}

export default function DescriptionTile({ settings, preview = false }: DescriptionTileProps) {
  if (!settings.content) {
    if (preview) return null
    return (
      <div className="w-full py-4 px-4 border rounded bg-gray-50">
        <p className="text-gray-400 text-sm">No description provided</p>
      </div>
    )
  }

  // Check if content is HTML (contains HTML tags) or markdown
  const isHTML = /<[a-z][\s\S]*>/i.test(settings.content)

  if (preview) {
    return (
      <div className="w-full py-8 pr-4 pl-4 md:pl-8 lg:pl-12 xl:pl-16" style={{ backgroundColor: 'transparent' }}>
        {isHTML ? (
          <div 
            className="prose prose-sm max-w-none" 
            style={{ backgroundColor: 'transparent' }}
            dangerouslySetInnerHTML={{ __html: settings.content }}
          />
        ) : (
          <div className="prose prose-sm max-w-none" style={{ backgroundColor: 'transparent' }}>
            {settings.content}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full py-4 pr-4 pl-4 md:pl-8 lg:pl-12 border rounded">
      {isHTML ? (
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: settings.content }}
        />
      ) : (
        <div className="prose prose-sm max-w-none">
          {settings.content}
        </div>
      )}
    </div>
  )
}

