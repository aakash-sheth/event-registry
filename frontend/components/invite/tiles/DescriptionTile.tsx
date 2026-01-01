'use client'

import React from 'react'
import { DescriptionTileSettings } from '@/lib/invite/schema'

export interface DescriptionTileProps {
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
    const styleContent = `
      .description-content p:empty,
      .description-content div:empty {
        min-height: 1.5em;
        margin: 0.5em 0;
        display: block;
      }
      .description-content p:empty:before,
      .description-content div:empty:before {
        content: "\\200B";
        color: transparent;
      }
    `
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: styleContent }} />
        <div className="w-full py-8 pr-4 pl-4 md:pl-8 lg:pl-12 xl:pl-16" style={{ backgroundColor: 'transparent' }}>
          {isHTML ? (
            <div 
              className="prose prose-sm max-w-none description-content" 
              style={{ backgroundColor: 'transparent' }}
              dangerouslySetInnerHTML={{ __html: settings.content }}
            />
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap description-content" style={{ backgroundColor: 'transparent' }}>
              {settings.content}
            </div>
          )}
        </div>
      </>
    )
  }

  const styleContent = `
    .description-content p:empty,
    .description-content div:empty {
      min-height: 1.5em;
      margin: 0.5em 0;
      display: block;
    }
    .description-content p:empty:before,
    .description-content div:empty:before {
      content: "\\200B";
      color: transparent;
    }
  `
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
      <div className="w-full py-4 pr-4 pl-4 md:pl-8 lg:pl-12 border rounded">
        {isHTML ? (
          <div 
            className="prose prose-sm max-w-none description-content"
            dangerouslySetInnerHTML={{ __html: settings.content }}
          />
        ) : (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap description-content">
            {settings.content}
          </div>
        )}
      </div>
    </>
  )
}

