'use client'

import React, { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import type { DescriptionTileSettings } from '@/lib/invite/schema'
import RichTextEditor from '@/components/invite/RichTextEditor'
import DescriptionEditorModal from '@/components/invite/DescriptionEditorModal'
import { Button } from '@/components/ui/button'

interface DescriptionTileSettingsProps {
  settings: DescriptionTileSettings
  onChange: (settings: DescriptionTileSettings) => void
}

export default function DescriptionTileSettings({ settings, onChange }: DescriptionTileSettingsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Description</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs border-eco-green text-eco-green hover:bg-eco-green hover:text-white"
          >
            <Maximize2 className="h-3 w-3 mr-1" />
            Full Screen Editor
          </Button>
        </div>
        <RichTextEditor
          value={settings.content || ''}
          onChange={(value) => onChange({ ...settings, content: value })}
          placeholder="Enter event description..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Use the toolbar to format text and add links. Click "Full Screen Editor" for a larger editing area.
        </p>
      </div>

      {/* Full Screen Editor Modal */}
      <DescriptionEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        value={settings.content || ''}
        onChange={(value) => onChange({ ...settings, content: value })}
        placeholder="Enter event description..."
      />
    </div>
  )
}

