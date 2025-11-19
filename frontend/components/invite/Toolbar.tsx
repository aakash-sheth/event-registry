'use client'

import { Upload, Plus, Sparkles, Eye, Rocket, Type, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ToolbarProps {
  onUploadBackground: () => void
  onAddText: () => void
  onAddSticker: () => void
  onAddRSVP: () => void
  onAddRegistry: () => void
  motionEnabled: boolean
  onToggleMotion: () => void
  onPreview: () => void
  onPublish: () => void
  hasBackground: boolean
}

export default function Toolbar({
  onUploadBackground,
  onAddText,
  onAddSticker,
  onAddRSVP,
  onAddRegistry,
  motionEnabled,
  onToggleMotion,
  onPreview,
  onPublish,
  hasBackground,
}: ToolbarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Upload Background (Optional) */}
          <Button
            onClick={onUploadBackground}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap border-eco-green text-eco-green hover:bg-eco-green-light"
          >
            <Upload className="w-4 h-4" />
            {hasBackground ? 'Change' : 'Add'} Background
          </Button>

          {/* Add Elements */}
          <div className="h-8 w-px bg-gray-300 mx-1" />
          
          {/* Add Text */}
          <Button
            onClick={onAddText}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap border-gray-300 hover:bg-gray-50"
          >
            <Type className="w-4 h-4" />
            Add Text
          </Button>

          {/* Add Sticker/Emoticon */}
          <Button
            onClick={onAddSticker}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap border-gray-300 hover:bg-gray-50"
          >
            <Smile className="w-4 h-4" />
            Add Sticker
          </Button>

          {/* Add Action Buttons */}
          <div className="h-8 w-px bg-gray-300 mx-1" />
          
          <Button
            onClick={onAddRSVP}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap border-gray-300 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            RSVP Button
          </Button>

          <Button
            onClick={onAddRegistry}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap border-gray-300 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Registry Button
          </Button>

          {/* Motion Toggle */}
          <div className="h-8 w-px bg-gray-300 mx-1" />
          
          <Button
            onClick={onToggleMotion}
            variant={motionEnabled ? 'default' : 'outline'}
            size="sm"
            className={`flex items-center gap-2 whitespace-nowrap ${
              motionEnabled
                ? 'bg-eco-green hover:bg-green-600 text-white'
                : 'border-gray-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Motion {motionEnabled ? 'On' : 'Off'}
          </Button>

          {/* Actions */}
          <div className="h-8 w-px bg-gray-300 mx-1" />
          
          <Button
            onClick={onPreview}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap border-gray-300"
          >
            <Eye className="w-4 h-4" />
            Preview
          </Button>

          <Button
            onClick={onPublish}
            variant="default"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap bg-eco-green hover:bg-green-600 text-white"
          >
            <Rocket className="w-4 h-4" />
            Publish
          </Button>
        </div>
      </div>
    </div>
  )
}

