'use client'

import React, { useState } from 'react'
import { ImageTileSettings } from '@/lib/invite/schema'
import { Button } from '@/components/ui/button'
import ImageCropModal from '@/components/invite/ImageCropModal'
import { getImageDimensions, extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'

interface ImageTileSettingsProps {
  settings: ImageTileSettings
  onChange: (settings: ImageTileSettings) => void
  hasTitleOverlay?: boolean
}

export default function ImageTileSettings({ settings, onChange, hasTitleOverlay = false }: ImageTileSettingsProps) {
  const [showCropModal, setShowCropModal] = useState(false)
  const [pendingImage, setPendingImage] = useState<{
    src: string
    dimensions: { width: number; height: number; aspectRatio: number }
  } | null>(null)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string
        const dimensions = await getImageDimensions(dataUrl)
        setPendingImage({ src: dataUrl, dimensions })
        setShowCropModal(true)
      } catch (error) {
        console.error('Error loading image:', error)
        // Fallback to basic upload
        onChange({ ...settings, src: dataUrl })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImageSrc: string) => {
    try {
      const dimensions = await getImageDimensions(croppedImageSrc)
      const colors = await extractDominantColors(croppedImageSrc, 3)
      const primaryColor = rgbToHex(colors[0] || 'rgb(0,0,0)')

      onChange({
        ...settings,
        src: croppedImageSrc,
        backgroundColor: primaryColor,
      })
      setShowCropModal(false)
      setPendingImage(null)
    } catch (error) {
      console.error('Error processing cropped image:', error)
      onChange({ ...settings, src: croppedImageSrc })
      setShowCropModal(false)
      setPendingImage(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Image Upload</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-eco-green file:text-white hover:file:bg-green-600"
        />
        <p className="text-xs text-gray-500 mt-1">Supported: JPG, PNG, WEBP (max 5MB)</p>
      </div>

      {settings.src && (
        <>
          <div className="border rounded-lg overflow-hidden">
            <img src={settings.src} alt="Preview" className="w-full h-48 object-cover" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fit Mode</label>
            <select
              value={settings.fitMode || 'fit-to-screen'}
              onChange={(e) => onChange({ ...settings, fitMode: e.target.value as any })}
              className="w-full text-sm border rounded px-3 py-2"
            >
              <option value="fit-to-screen">Fit to Screen</option>
              <option value="full-image">Full Image</option>
              <option value="crop-selected-section">Crop Selected Section</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={settings.backgroundColor || '#ffffff'}
                onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                placeholder="#FFFFFF"
                className="flex-1 text-sm border rounded px-3 py-2"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Used when image doesn't fill the screen</p>
          </div>

          {hasTitleOverlay && (
            <div>
              <label className="block text-sm font-medium mb-2">Blur (when title overlay is active)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.blur || 0}
                onChange={(e) => onChange({ ...settings, blur: parseInt(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Blur value: {settings.blur || 0}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (settings.src) {
                  getImageDimensions(settings.src).then(dimensions => {
                    setPendingImage({ src: settings.src!, dimensions })
                    setShowCropModal(true)
                  })
                }
              }}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              ✂️ Crop Image
            </Button>
            <Button
              onClick={() => onChange({ ...settings, src: undefined })}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              Remove Image
            </Button>
          </div>
        </>
      )}

      {showCropModal && pendingImage && (
        <ImageCropModal
          imageSrc={pendingImage.src}
          imageDimensions={pendingImage.dimensions}
          recommendedAspectRatio={0.75}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowCropModal(false)
            setPendingImage(null)
          }}
        />
      )}
    </div>
  )
}

