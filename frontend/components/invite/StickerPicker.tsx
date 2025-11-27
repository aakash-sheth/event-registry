'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STICKER_LIBRARY, STICKER_CATEGORIES, StickerItem, getAllCategories } from '@/lib/invite/stickers'

interface StickerPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (sticker: StickerItem) => void
}

export default function StickerPicker({ isOpen, onClose, onSelect }: StickerPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('celebration')

  if (!isOpen) return null

  const categories = getAllCategories()
  const stickersInCategory = STICKER_LIBRARY.filter(s => s.category === selectedCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Choose a Sticker or Emoticon</h3>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 p-4 border-b overflow-x-auto bg-gray-50">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-eco-green text-white hover:bg-green-600'
                  : 'border-gray-300'
              }`}
            >
              {STICKER_CATEGORIES[cat as keyof typeof STICKER_CATEGORIES]}
            </Button>
          ))}
        </div>

        {/* Sticker Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {stickersInCategory.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => {
                  onSelect(sticker)
                  onClose()
                }}
                className="aspect-square flex items-center justify-center text-4xl hover:bg-gray-100 rounded-lg transition-colors cursor-pointer border-2 border-transparent hover:border-eco-green"
                title={sticker.name}
              >
                {sticker.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

