'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export default function ScrollIndicator() {
  const [showIndicator, setShowIndicator] = useState(false)

  useEffect(() => {
    const checkScroll = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY || document.documentElement.scrollTop

      // Show indicator only if:
      // 1. There's more content below (document height > window height)
      // 2. User hasn't scrolled to the bottom (with some threshold)
      const isScrollable = documentHeight > windowHeight
      const isNearBottom = scrollTop + windowHeight >= documentHeight - 100 // 100px threshold

      setShowIndicator(isScrollable && !isNearBottom)
    }

    // Small delay before first check to allow page to render
    const initialDelay = setTimeout(checkScroll, 500)

    // Check on scroll and resize
    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)

    return () => {
      clearTimeout(initialDelay)
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [])

  if (!showIndicator) return null

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
      <div className="animate-bounce">
        <ChevronDown className="w-6 h-6 text-gray-600 opacity-70 drop-shadow-sm" />
      </div>
    </div>
  )
}

