'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { InviteConfig } from '@/lib/invite/schema'

const DEFAULT_COLORS = {
  backgroundColor: '#ffffff',
  fontColor: '#000000',
  primaryColor: '#0D6EFD',
  mutedColor: '#6B7280',
}

const DEFAULT_FONTS = {
  bodyFont: 'Inter, system-ui',
}

export interface DescriptionProps {
  markdown: string
  config: InviteConfig
}

export default function Description({ markdown, config }: DescriptionProps) {
  const backgroundColor = config.customColors?.backgroundColor || DEFAULT_COLORS.backgroundColor
  const fontColor = config.customColors?.fontColor || DEFAULT_COLORS.fontColor
  const primaryColor = config.customColors?.primaryColor || DEFAULT_COLORS.primaryColor
  const mutedColor = config.customColors?.mutedColor || DEFAULT_COLORS.mutedColor
  const bodyFont = config.customFonts?.bodyFont || DEFAULT_FONTS.bodyFont
  return (
    <section
      className="w-full py-16 px-4 md:px-8"
      style={{
        backgroundColor,
        color: fontColor,
        fontFamily: bodyFont,
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="prose prose-lg md:prose-xl max-w-none"
          style={{
            color: fontColor,
            lineHeight: '1.8',
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  className="text-3xl md:text-4xl font-bold mb-6 mt-8 first:mt-0"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  className="text-2xl md:text-3xl font-bold mb-4 mt-8 first:mt-0"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              h3: ({ node, ...props }) => (
                <h3
                  className="text-xl md:text-2xl font-semibold mb-3 mt-6 first:mt-0"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              p: ({ node, ...props }) => (
                <p
                  className="mb-4 leading-relaxed"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              ul: ({ node, ...props }) => (
                <ul
                  className="list-disc list-inside mb-4 space-y-2 ml-4"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol
                  className="list-decimal list-inside mb-4 space-y-2 ml-4"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              li: ({ node, ...props }) => (
                <li className="leading-relaxed" {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong
                  className="font-bold"
                  style={{ color: fontColor }}
                  {...props}
                />
              ),
              em: ({ node, ...props }) => (
                <em className="italic" {...props} />
              ),
              a: ({ node, href, ...props }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 rounded"
                  style={{
                    color: primaryColor,
                  }}
                  {...props}
                />
              ),
              img: ({ node, src, alt, ...props }) => (
                <img
                  src={src}
                  alt={alt}
                  className="w-full h-auto rounded-lg my-6 max-w-full"
                  loading="lazy"
                  {...props}
                />
              ),
              hr: ({ node, ...props }) => (
                <hr
                  className="my-8 border-0 border-t"
                  style={{ borderColor: mutedColor }}
                  {...props}
                />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className="border-l-4 pl-4 my-6 italic"
                  style={{
                    borderColor: primaryColor,
                    color: mutedColor,
                  }}
                  {...props}
                />
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  )
}

