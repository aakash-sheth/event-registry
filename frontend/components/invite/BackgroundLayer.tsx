'use client'

import { useEffect, useState } from 'react'

interface BackgroundLayerProps {
  backgroundUrl: string | null
  overlay?: boolean
  className?: string
}

export default function BackgroundLayer({ backgroundUrl, overlay = false, className = '' }: BackgroundLayerProps) {
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    if (backgroundUrl) {
      const img = new Image()
      img.onload = () => setImageLoaded(true)
      img.src = backgroundUrl
    }
  }, [backgroundUrl])

  if (!backgroundUrl) {
    return (
      <div className={`absolute inset-0 bg-gradient-to-br from-eco-green-light to-green-100 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm">Upload a background image</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 ${className}`}>
      <img
        src={backgroundUrl}
        alt="Invitation background"
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20 pointer-events-none" />
      )}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      )}
    </div>
  )
}

