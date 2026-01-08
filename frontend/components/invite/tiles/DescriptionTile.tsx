'use client'

import React, { useEffect, useRef } from 'react'
import { DescriptionTileSettings } from '@/lib/invite/schema'

export interface DescriptionTileProps {
  settings: DescriptionTileSettings
  preview?: boolean
}

export default function DescriptionTile({ settings, preview = false }: DescriptionTileProps) {
  const contentRef = useRef<HTMLDivElement>(null)
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

  // Ensure empty paragraphs (with only <br>) are preserved after render
  useEffect(() => {
    if (contentRef.current && isHTML) {
      // Use a small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        if (contentRef.current) {
          const paragraphs = contentRef.current.querySelectorAll('p')
          paragraphs.forEach((p) => {
            const textContent = p.textContent?.trim() || ''
            const innerHTML = p.innerHTML.trim()
            // Normalize <br/> to <br> for consistency
            const normalizedHTML = innerHTML.replace(/<br\s*\/?>/gi, '<br>')
            
            // If paragraph is empty or contains only <br>, ensure it has proper spacing
            if (textContent === '' && (normalizedHTML === '' || normalizedHTML === '<br>')) {
              // Add a class to mark it as an empty line
              p.classList.add('empty-line')
              // Ensure it has a <br> if it's completely empty
              if (normalizedHTML === '') {
                p.innerHTML = '<br>'
              }
              // Force inline styles to ensure visibility
              p.style.minHeight = '1.5em'
              p.style.display = 'block'
              p.style.marginTop = '0.5em'
              p.style.marginBottom = '0.5em'
              p.style.lineHeight = '1.5em'
            }
          })
        }
      }, 50) // Slightly longer delay to ensure DOM is ready
      
      return () => clearTimeout(timer)
    }
  }, [settings.content, isHTML])

  if (preview) {
    const styleContent = `
      /* Ensure paragraphs have proper spacing to preserve line breaks */
      /* Override prose class margin collapsing - use padding instead of margin for more reliable spacing */
      .description-content p {
        margin-top: 0.5em !important;
        margin-bottom: 0.5em !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        display: block !important;
        min-height: 1em;
      }
      /* Prevent prose from collapsing margins between paragraphs */
      .description-content p + p {
        margin-top: 0.5em !important;
      }
      .description-content p:first-child {
        margin-top: 0 !important;
      }
      .description-content p:last-child {
        margin-bottom: 0 !important;
      }
      /* Handle empty paragraphs and paragraphs with only <br> */
      .description-content p:empty,
      .description-content div:empty {
        min-height: 1.5em;
        margin: 0.5em 0 !important;
        display: block;
      }
      /* Paragraphs containing only <br> should also be treated as empty lines */
      .description-content p.empty-line,
      .description-content p:has(> br:only-child) {
        min-height: 1.5em !important;
        margin: 0.5em 0 !important;
        display: block !important;
        line-height: 1.5em !important;
      }
      /* Also handle paragraphs that might have whitespace or zero-width spaces */
      .description-content p.empty-line br {
        display: block;
        content: "";
        margin-top: 0.5em;
      }
      .description-content p:empty:before,
      .description-content div:empty:before {
        content: "\\200B";
        color: transparent;
      }
      /* Preserve inline text-align styles - inline styles should have higher specificity than prose class */
      /* But add !important to ensure they override any prose defaults */
      .description-content p[style*="text-align: left"],
      .description-content div[style*="text-align: left"] {
        text-align: left !important;
      }
      .description-content p[style*="text-align: center"],
      .description-content div[style*="text-align: center"] {
        text-align: center !important;
      }
      .description-content p[style*="text-align: right"],
      .description-content div[style*="text-align: right"] {
        text-align: right !important;
      }
      .description-content p[style*="text-align: justify"],
      .description-content div[style*="text-align: justify"] {
        text-align: justify !important;
      }
    `
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: styleContent }} />
        <div className="w-full py-12 px-6" style={{ backgroundColor: 'transparent' }}>
          <div className="max-w-2xl mx-auto">
            {isHTML ? (
              <div 
                ref={contentRef}
                className="prose prose-lg max-w-none description-content break-words" 
                style={{ backgroundColor: 'transparent' }}
                dangerouslySetInnerHTML={{ __html: settings.content }}
              />
            ) : (
              <div 
                className="prose prose-lg max-w-none whitespace-pre-wrap description-content break-words" 
                style={{ backgroundColor: 'transparent' }}
              >
                {settings.content}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  const styleContent = `
    /* Ensure paragraphs have proper spacing to preserve line breaks */
    /* Override prose class margin collapsing - use padding instead of margin for more reliable spacing */
    .description-content p {
      margin-top: 0.5em !important;
      margin-bottom: 0.5em !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      display: block !important;
      min-height: 1em;
    }
    /* Prevent prose from collapsing margins between paragraphs */
    .description-content p + p {
      margin-top: 0.5em !important;
    }
    .description-content p:first-child {
      margin-top: 0 !important;
    }
    .description-content p:last-child {
      margin-bottom: 0 !important;
    }
    /* Handle empty paragraphs and paragraphs with only <br> */
    .description-content p:empty,
    .description-content div:empty {
      min-height: 1.5em;
      margin: 0.5em 0 !important;
      display: block;
    }
    /* Paragraphs containing only <br> should also be treated as empty lines */
    .description-content p.empty-line,
    .description-content p:has(> br:only-child) {
      min-height: 1.5em !important;
      margin: 0.5em 0 !important;
      display: block !important;
      line-height: 1.5em !important;
    }
    /* Also handle paragraphs that might have whitespace or zero-width spaces */
    .description-content p.empty-line br {
      display: block;
      content: "";
      margin-top: 0.5em;
    }
    .description-content p:empty:before,
    .description-content div:empty:before {
      content: "\\200B";
      color: transparent;
    }
    /* Preserve inline text-align styles - inline styles should have higher specificity than prose class */
    /* But add !important to ensure they override any prose defaults */
    .description-content p[style*="text-align: left"],
    .description-content div[style*="text-align: left"] {
      text-align: left !important;
    }
    .description-content p[style*="text-align: center"],
    .description-content div[style*="text-align: center"] {
      text-align: center !important;
    }
    .description-content p[style*="text-align: right"],
    .description-content div[style*="text-align: right"] {
      text-align: right !important;
    }
    .description-content p[style*="text-align: justify"],
    .description-content div[style*="text-align: justify"] {
      text-align: justify !important;
    }
  `
  
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
      <div 
        className="w-full py-6 px-4"
        style={{
          backgroundColor: '#F9FAFB', // Match EventDetailsTile default background
        }}
      >
        <div className="max-w-2xl mx-auto">
          {isHTML ? (
            <div 
              ref={contentRef}
              className="prose prose-lg max-w-none description-content break-words"
              dangerouslySetInnerHTML={{ __html: settings.content }}
            />
          ) : (
            <div className="prose prose-lg max-w-none whitespace-pre-wrap description-content break-words">
              {settings.content}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

