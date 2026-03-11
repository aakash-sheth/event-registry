'use client'

import React, { useMemo, useState, useRef, useEffect, Component, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { InviteTemplate } from '@/lib/invite/templates'
import TemplateCardPreview from '@/components/invite/TemplateCardPreview'

class PreviewErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export interface TemplateLibraryProps {
  templates: InviteTemplate[]
  onSelect: (templateId: string) => void
  onCancel?: () => void
  onBlankCanvas?: () => void
  selectedId?: string
}

function ThumbnailFallback({
  template,
  onError,
  imageFallbackLabel,
}: {
  template: InviteTemplate
  onError: () => void
  imageFallbackLabel: string
}) {
  return (
    <img
      src={template.thumbnail}
      alt={template.previewAlt || `${template.name} invitation preview`}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      onError={onError}
    />
  )
}

function LazyPreviewWrapper({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true)
      },
      { rootMargin: '100px', threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="h-full w-full">
      {inView ? children : fallback}
    </div>
  )
}

function CardPreviewContent({
  template,
  failedImageIds,
  setFailedImageIds,
  failedPreviewIds,
  setFailedPreviewIds,
  imageFallbackLabel,
}: {
  template: InviteTemplate
  failedImageIds: Record<string, boolean>
  setFailedImageIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  failedPreviewIds: Record<string, boolean>
  setFailedPreviewIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  imageFallbackLabel: string
}) {
  const hasConfig = template.config?.tiles && template.config.tiles.length > 0
  const useLivePreview = hasConfig && !failedPreviewIds[template.id]

  const thumbnailFallback = (
    <ThumbnailFallback
      template={template}
      onError={() => setFailedImageIds(prev => ({ ...prev, [template.id]: true }))}
      imageFallbackLabel={imageFallbackLabel}
    />
  )

  if (failedImageIds[template.id] || (!hasConfig && failedPreviewIds[template.id])) {
    return (
      <div className="h-full w-full flex items-center justify-center px-4 text-center text-sm text-gray-500 bg-gray-50">
        {imageFallbackLabel}
      </div>
    )
  }

  if (useLivePreview) {
    return (
      <LazyPreviewWrapper fallback={thumbnailFallback}>
        <PreviewErrorBoundary
          fallback={thumbnailFallback}
          onError={() => setFailedPreviewIds(prev => ({ ...prev, [template.id]: true }))}
        >
          <TemplateCardPreview
            config={template.config}
            className="h-full w-full"
          />
        </PreviewErrorBoundary>
      </LazyPreviewWrapper>
    )
  }

  return thumbnailFallback
}

export default function TemplateLibrary({
  templates,
  onSelect,
  onCancel,
  onBlankCanvas,
  selectedId,
}: TemplateLibraryProps): React.ReactElement {
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({})
  const [failedPreviewIds, setFailedPreviewIds] = useState<Record<string, boolean>>({})

  const imageFallbackLabel = useMemo(
    () => 'Template preview unavailable',
    []
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {onBlankCanvas && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Start from a blank canvas"
            onClick={onBlankCanvas}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onBlankCanvas()
              }
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-white hover:border-eco-green hover:shadow-lg transition-all duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-eco-green focus:ring-offset-2 flex flex-col"
          >
            <div className="relative w-full bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4" style={{ aspectRatio: '9/16' }}>
              <div className="w-full max-w-[200px] mx-auto aspect-[9/16] rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-3">
                <span className="text-4xl text-gray-300 select-none" aria-hidden>+</span>
                <span className="text-xs text-gray-400 font-medium">Blank canvas</span>
              </div>
            </div>
            <div className="px-4 py-3">
              <h3 className="text-xl font-semibold text-gray-900">Start from scratch</h3>
              <p className="text-sm text-gray-600 mt-0.5 leading-snug">Build your invite page tile by tile.</p>
            </div>
            <div className="px-4 pb-5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-2 border-gray-300 text-gray-600 hover:border-eco-green hover:text-eco-green font-medium rounded-lg py-2"
                onClick={(e) => {
                  e.stopPropagation()
                  onBlankCanvas()
                }}
              >
                Use blank canvas
              </Button>
            </div>
          </div>
        )}
        {templates.map((template) => (
          <Card
            key={template.id}
            role="button"
            tabIndex={0}
            aria-label={`Select ${template.name} template`}
            className={`cursor-pointer transition-all duration-200 hover:shadow-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-eco-green focus:ring-offset-2 rounded-xl bg-white ${selectedId === template.id ? 'border-2 border-eco-green shadow-xl ring-2 ring-eco-green ring-offset-2' : 'border border-gray-200 hover:border-eco-green'}`}
            onClick={() => onSelect(template.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(template.id)
              }
            }}
          >
            {/* Preview as an invite card: framed, elevated, so it feels like a real invite */}
            <div
              className="relative w-full aspect-[9/16] overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4"
              aria-label={template.previewAlt || `${template.name} invitation preview`}
            >
              <div className="w-full max-w-[200px] mx-auto aspect-[9/16] rounded-xl shadow-xl overflow-hidden border border-gray-200/90 bg-white ring-1 ring-black/5">
                <CardPreviewContent
                  template={template}
                  failedImageIds={failedImageIds}
                  setFailedImageIds={setFailedImageIds}
                  failedPreviewIds={failedPreviewIds}
                  setFailedPreviewIds={setFailedPreviewIds}
                  imageFallbackLabel={imageFallbackLabel}
                />
              </div>
            </div>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xl font-semibold text-gray-900">{template.name}</CardTitle>
              {template.description && (
                <CardDescription className="text-sm text-gray-600 mt-0.5 leading-snug">
                  {template.description}
                </CardDescription>
              )}
              {template.createdByName && (
                <p className="text-xs text-gray-500 mt-1.5">By {template.createdByName}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0 pb-5">
              <Button
                type="button"
                size="sm"
                className={`w-full font-medium rounded-lg py-2 transition-colors ${
                  selectedId === template.id
                    ? 'bg-eco-green text-white border-2 border-eco-green'
                    : 'border-2 border-eco-green text-eco-green bg-white hover:bg-eco-green hover:text-white'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(template.id)
                }}
              >
                {selectedId === template.id ? '✓ Selected' : 'Select'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {onCancel && (
        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
