'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getGreetingCardSamples, type GreetingCardSample, type TextOverlay } from '@/lib/invite/api'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (src: string, textOverlays: TextOverlay[]) => void
}

export default function GreetingCardMediaPicker({ open, onClose, onSelect }: Props) {
  const [cards, setCards] = useState<GreetingCardSample[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getGreetingCardSamples()
      .then(setCards)
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort()
  const filtered = activeTag ? cards.filter((c) => c.tags.includes(activeTag)) : cards

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Greeting Card Media Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="px-5 py-3 border-b flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeTag === null
                  ? 'bg-eco-green text-white border-eco-green'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                  activeTag === tag
                    ? 'bg-eco-green text-white border-eco-green'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Loading cards...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              No greeting cards found.
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filtered.map((card) => (
                <div key={card.id} className="flex flex-col rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors group">
                  {/* 9:16 thumbnail */}
                  <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                    <img
                      src={card.background_image_url}
                      alt={card.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>

                  {/* Card info + select button */}
                  <div className="p-3 flex flex-col gap-2 bg-white">
                    <p className="text-sm font-medium text-gray-800 truncate">{card.name}</p>
                    {card.tags.length > 0 && (
                      <p className="text-xs text-gray-500 truncate capitalize">
                        {card.tags.join(', ')}
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => {
                        onSelect(card.background_image_url, card.text_overlays)
                        onClose()
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
