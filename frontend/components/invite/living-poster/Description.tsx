'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Theme } from '@/lib/invite/themes'

interface DescriptionProps {
  markdown: string
  theme: Theme
}

export default function Description({ markdown, theme }: DescriptionProps) {
  return (
    <section
      className="w-full py-16 px-4 md:px-8"
      style={{
        backgroundColor: theme.palette.bg,
        color: theme.palette.fg,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="prose prose-lg md:prose-xl max-w-none"
          style={{
            color: theme.palette.fg,
            lineHeight: '1.8',
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  className="text-3xl md:text-4xl font-bold mb-6 mt-8 first:mt-0"
                  style={{ color: theme.palette.fg }}
                  {...props}
                />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  className="text-2xl md:text-3xl font-bold mb-4 mt-8 first:mt-0"
                  style={{ color: theme.palette.fg }}
                  {...props}
                />
              ),
              h3: ({ node, ...props }) => (
                <h3
                  className="text-xl md:text-2xl font-semibold mb-3 mt-6 first:mt-0"
                  style={{ color: theme.palette.fg }}
                  {...props}
                />
              ),
              p: ({ node, ...props }) => (
                <p
                  className="mb-4 leading-relaxed"
                  style={{ color: theme.palette.fg }}
                  {...props}
                />
              ),
              ul: ({ node, ...props }) => (
                <ul
                  className="list-disc list-inside mb-4 space-y-2 ml-4"
                  style={{ color: theme.palette.fg }}
                  {...props}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol
                  className="list-decimal list-inside mb-4 space-y-2 ml-4"
                  style={{ color: theme.palette.fg }}
                  {...props}
                />
              ),
              li: ({ node, ...props }) => (
                <li className="leading-relaxed" {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong
                  className="font-bold"
                  style={{ color: theme.palette.fg }}
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
                    color: theme.palette.primary,
                    focusRingColor: theme.palette.primary,
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
                  style={{ borderColor: theme.palette.muted }}
                  {...props}
                />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className="border-l-4 pl-4 my-6 italic"
                  style={{
                    borderColor: theme.palette.primary,
                    color: theme.palette.muted,
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

