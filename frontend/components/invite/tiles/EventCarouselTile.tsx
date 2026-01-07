'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { EventCarouselTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import { 
  getImageDimensions, 
  calculateOptimalDimensions, 
  getRecommendedCarouselDimensions,
  type ImageDimensions 
} from '@/lib/invite/imageUtils'

interface SubEvent {
  id: number
  title: string
  start_at: string
  end_at?: string | null
  location: string
  description?: string | null
  image_url?: string | null
  background_color?: string | null
  rsvp_enabled: boolean
}

export interface EventCarouselTileProps {
  settings: EventCarouselTileSettings
  allowedSubEvents?: SubEvent[]
  preview?: boolean
  eventSlug?: string
}

// Design tokens
const designTokens = {
  transitions: {
    default: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast: '200ms ease-in-out',
    slow: '600ms ease-in-out',
  },
  spacing: {
    cardPadding: { tight: 16, normal: 24, spacious: 32 },
    elementGap: 12,
    iconGap: 8,
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 15px rgba(0,0,0,0.1)',
    xl: '0 20px 25px rgba(0,0,0,0.15)',
  },
  breakpoints: {
    mobile: 640,
    tablet: 1024,
    desktop: 1280,
  },
}

export default function EventCarouselTile({ 
  settings, 
  allowedSubEvents = [], 
  preview = false,
  eventSlug 
}: EventCarouselTileProps) {
  // State management
  const [mounted, setMounted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [imageDimensionsMap, setImageDimensionsMap] = useState<Map<string, ImageDimensions>>(new Map())
  
  // Refs
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const loadingImagesRef = useRef<Set<string>>(new Set())

  // Check for reduced motion preference
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReducedMotion(mediaQuery.matches)
      
      const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  // Load image dimensions for all sub-event images
  useEffect(() => {
    if (!mounted || !allowedSubEvents || allowedSubEvents.length === 0) return

    allowedSubEvents.forEach((subEvent) => {
      if (subEvent.image_url) {
        const imageUrl = subEvent.image_url
        // Skip if already loaded or currently loading
        if (imageDimensionsMap.has(imageUrl) || loadingImagesRef.current.has(imageUrl)) {
          return
        }
        
        // Mark as loading
        loadingImagesRef.current.add(imageUrl)
        
        // Load dimensions asynchronously
        getImageDimensions(imageUrl)
          .then((dims) => {
            setImageDimensionsMap((current) => {
              const newMap = new Map(current)
              newMap.set(imageUrl, dims)
              return newMap
            })
            loadingImagesRef.current.delete(imageUrl)
          })
          .catch((error) => {
            // Handle error gracefully - don't break carousel if dimension loading fails
            console.warn('Failed to load image dimensions:', error)
            loadingImagesRef.current.delete(imageUrl)
          })
      }
    })
  }, [mounted, allowedSubEvents, imageDimensionsMap])

  // Memoize settings to ensure component reacts to changes
  const normalizedSettings = useMemo(() => ({
    ...settings,
    showFields: settings.showFields || {},
  }), [settings])


  // Default settings with fallbacks - use explicit checks to handle undefined vs false
  // Read directly from normalizedSettings to ensure we get latest values
  const autoPlay = normalizedSettings.autoPlay === undefined ? true : normalizedSettings.autoPlay
  const autoPlayInterval = normalizedSettings.autoPlayInterval || 5000
  const showArrows = normalizedSettings.showArrows === undefined ? true : normalizedSettings.showArrows
  const showDots = normalizedSettings.showDots === undefined ? true : normalizedSettings.showDots

  // Navigation functions
  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= allowedSubEvents.length) return
    setCurrentIndex(index)
    setIsPaused(true)
    
    // Announce to screen readers
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `Slide ${index + 1} of ${allowedSubEvents.length}`
    }
    
    // Resume auto-play after 3s
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false)
    }, 3000)
  }, [allowedSubEvents.length])

  const goToPrevious = useCallback(() => {
    goToSlide(currentIndex === 0 ? allowedSubEvents.length - 1 : currentIndex - 1)
  }, [currentIndex, allowedSubEvents.length, goToSlide])

  const goToNext = useCallback(() => {
    goToSlide(currentIndex === allowedSubEvents.length - 1 ? 0 : currentIndex + 1)
  }, [currentIndex, allowedSubEvents.length, goToSlide])

  // Auto-play logic
  useEffect(() => {
    if (!mounted || !autoPlay || allowedSubEvents.length <= 1 || isPaused) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
      setIsAutoPlaying(false)
      return
    }

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev === allowedSubEvents.length - 1 ? 0 : prev + 1
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = `Slide ${next + 1} of ${allowedSubEvents.length}`
        }
        return next
      })
    }, autoPlayInterval)

    setIsAutoPlaying(true)

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [mounted, autoPlay, autoPlayInterval, allowedSubEvents.length, isPaused])

  // Pause on hover/focus
  const handleMouseEnter = useCallback(() => {
    setIsPaused(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (autoPlay) {
      setTimeout(() => setIsPaused(false), 3000)
    }
  }, [autoPlay])

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
    setIsPaused(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEndX(e.touches[0].clientX)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX || !touchEndX) return
    
    const distance = touchStartX - touchEndX
    const minSwipeDistance = 50
    const velocity = Math.abs(distance) / 300 // Approximate velocity

    if (Math.abs(distance) > minSwipeDistance && velocity > 0.3) {
      if (distance > 0) {
        goToNext()
      } else {
        goToPrevious()
      }
    }

    setTouchStartX(null)
    setTouchEndX(null)
    
    // Resume auto-play after 3s
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false)
    }, 3000)
  }, [touchStartX, touchEndX, goToNext, goToPrevious])

  // Keyboard navigation
  useEffect(() => {
    if (!mounted || !carouselRef.current) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== carouselRef.current && !carouselRef.current?.contains(document.activeElement)) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break
        case 'Home':
          e.preventDefault()
          goToSlide(0)
          break
        case 'End':
          e.preventDefault()
          goToSlide(allowedSubEvents.length - 1)
          break
        case ' ':
          e.preventDefault()
          setIsPaused((prev) => !prev)
          if (liveRegionRef.current) {
            liveRegionRef.current.textContent = isPaused ? 'Carousel playing' : 'Carousel paused'
          }
          break
      }
    }

    const carousel = carouselRef.current
    carousel.addEventListener('keydown', handleKeyDown)
    carousel.setAttribute('tabindex', '0')

    return () => {
      carousel.removeEventListener('keydown', handleKeyDown)
    }
  }, [mounted, goToPrevious, goToNext, goToSlide, allowedSubEvents.length, isPaused])

  // Date/time formatting
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }, [])

  const formatTime = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return ''
    }
  }, [])

  const formatDateTime = useCallback((startAt: string, endAt?: string | null) => {
    const startDate = formatDate(startAt)
    const startTime = formatTime(startAt)
    
    if (endAt) {
      const endTime = formatTime(endAt)
      return `${startDate} • ${startTime} - ${endTime}`
    }
    
    return `${startDate} • ${startTime}`
  }, [formatDate, formatTime])

  // Card style getters - ensure they react to settings changes
  const getCardStyleClasses = useCallback(() => {
    const base = 'overflow-hidden transition-all duration-300'
    const shadow = normalizedSettings.cardShadow || 'md'
    const currentCardStyle = normalizedSettings.cardStyle || 'elegant'

    const styleClasses: Record<string, string> = {
      minimal: 'border border-gray-200',
      elegant: 'shadow-lg',
      modern: 'shadow-xl border border-gray-100',
      classic: 'shadow-md border-2 border-gray-200',
    }

    const shadowClasses: Record<string, string> = {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
    }

    return `${base} ${styleClasses[currentCardStyle]} ${shadowClasses[shadow]}`.trim()
  }, [normalizedSettings.cardStyle, normalizedSettings.cardShadow])

  const getImageHeightClass = useCallback(() => {
    const currentImageHeight = normalizedSettings.imageHeight || 'medium'
    const heights: Record<string, string> = {
      small: 'h-48',
      medium: 'h-64',
      large: 'h-96',
      full: 'h-[500px]',
    }
    return heights[currentImageHeight]
  }, [normalizedSettings.imageHeight])

  const getImageAspectRatioStyle = useCallback(() => {
    const currentAspectRatio = normalizedSettings.imageAspectRatio || '16:9'
    if (currentAspectRatio === 'auto') return {}
    
    const ratios: Record<string, string> = {
      '16:9': '16/9',
      '4:3': '4/3',
      '1:1': '1/1',
    }
    
    return { aspectRatio: ratios[currentAspectRatio] }
  }, [normalizedSettings.imageAspectRatio])

  const getCardPaddingClass = useCallback(() => {
    const currentPadding = normalizedSettings.cardPadding || 'normal'
    const paddings: Record<string, string> = {
      tight: 'p-4',
      normal: 'p-6',
      spacious: 'p-8',
    }
    return paddings[currentPadding]
  }, [normalizedSettings.cardPadding])

  // Render card - ensure it reacts to all settings changes
  const renderSubEventCard = useCallback((subEvent: SubEvent, index: number) => {
    const showFields = normalizedSettings.showFields || {}
    const isActive = index === currentIndex
    
    // Extract styling from settings with defaults
    const titleStyling = normalizedSettings.subEventTitleStyling || {}
    const detailsStyling = normalizedSettings.subEventDetailsStyling || {}
    
    const titleFont = titleStyling.font || FONT_OPTIONS[0].family
    const titleColor = titleStyling.color || '#111827' // gray-900
    const titleSize = titleStyling.size || 'medium'
    const detailsColor = detailsStyling.fontColor || '#4B5563' // gray-600
    
    // Size class mapping (same as TitleTile)
    const titleSizeClasses = {
      small: 'text-xl',
      medium: 'text-2xl',
      large: 'text-3xl',
      xlarge: 'text-4xl',
    }
    
    const cardStyleClasses = getCardStyleClasses()
    const imageHeightClass = getImageHeightClass()
    const imageAspectStyle = getImageAspectRatioStyle()
    const cardPaddingClass = getCardPaddingClass()

    const cardStyle: React.CSSProperties = {
      borderRadius: `${normalizedSettings.cardBorderRadius ?? 12}px`,
      backgroundColor: normalizedSettings.cardBackgroundColor || '#ffffff',
      borderWidth: normalizedSettings.cardBorderWidth ?? 0,
      borderColor: normalizedSettings.cardBorderColor || 'transparent',
      borderStyle: normalizedSettings.cardBorderStyle || 'solid',
      transition: reducedMotion ? 'none' : designTokens.transitions.default,
      opacity: isActive ? 1 : 0,
      transform: isActive 
        ? (reducedMotion ? 'none' : 'scale(1) translateX(0)')
        : (reducedMotion ? 'none' : 'scale(0.98) translateX(20px)'),
      position: isActive ? 'relative' : 'absolute',
      pointerEvents: isActive ? 'auto' : 'none',
      zIndex: isActive ? 10 : 1,
    }

    return (
      <div
        key={subEvent.id}
        className={`${cardStyleClasses} w-full`}
        style={cardStyle}
      >
        {showFields.image && subEvent.image_url && (() => {
          const recommendedDims = getRecommendedCarouselDimensions(
            normalizedSettings.imageHeight || 'medium',
            normalizedSettings.imageAspectRatio || '16:9'
          )

          // Always use recommended dimensions from the start to prevent layout shift
          // The container size is fixed, and object-fit: contain will handle scaling
          const backgroundColor = subEvent.background_color || '#e5e7eb' // Default to gray-200 if not set
          return (
            <div 
              className={`w-full ${imageHeightClass} overflow-hidden flex items-center justify-center`} 
              style={{
                ...imageAspectStyle,
                backgroundColor,
                maxWidth: '100%',
                maxHeight: `${recommendedDims.maxHeight}px`,
                height: `${recommendedDims.maxHeight}px`, // Fixed height to prevent shift
              }}
            >
              <img
                src={subEvent.image_url}
                alt={subEvent.title}
                style={{
                  objectFit: 'contain',
                  maxWidth: `${recommendedDims.maxWidth}px`,
                  maxHeight: `${recommendedDims.maxHeight}px`,
                  width: 'auto',
                  height: 'auto',
                  display: 'block',
                }}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>
          )
        })()}
        
        <div className={cardPaddingClass}>
          {showFields.title && (
            <h3 
              className={`${titleSizeClasses[titleSize]} font-semibold mb-3`}
              style={{ 
                fontFamily: titleFont, 
                color: titleColor 
              }}
            >
              {subEvent.title}
            </h3>
          )}
          
          {showFields.dateTime && (
            <div 
              className="flex items-start gap-2 mb-2"
              style={{ color: detailsColor }}
            >
              <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span className="text-sm" suppressHydrationWarning>
                {formatDateTime(subEvent.start_at, subEvent.end_at)}
              </span>
            </div>
          )}
          
          {showFields.location && subEvent.location && (
            <div 
              className="flex items-start gap-2 mb-3"
              style={{ color: detailsColor }}
            >
              <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{subEvent.location}</span>
            </div>
          )}
          
          {subEvent.description && (() => {
            // Check if description contains HTML tags
            const isHTML = /<[a-z][\s\S]*>/i.test(subEvent.description)
            const style = {
              display: '-webkit-box' as const,
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical' as const,
              lineHeight: '1.5',
            }
            
            if (isHTML) {
              return (
                <div 
                  className="text-gray-700 text-sm mb-4 prose prose-sm max-w-none overflow-hidden break-words"
                  style={style}
                  dangerouslySetInnerHTML={{ __html: subEvent.description }}
                />
              )
            }
            
            return (
              <div 
                className="text-gray-700 text-sm mb-4 prose prose-sm max-w-none overflow-hidden break-words"
                style={style}
              >
                {subEvent.description}
              </div>
            )
          })()}
        </div>
      </div>
    )
  }, [
    currentIndex,
    normalizedSettings,
    normalizedSettings.showFields,
    normalizedSettings.subEventTitleStyling,
    normalizedSettings.subEventDetailsStyling,
    normalizedSettings.cardBackgroundColor,
    normalizedSettings.cardBorderRadius,
    normalizedSettings.cardBorderWidth,
    normalizedSettings.cardBorderColor,
    normalizedSettings.cardBorderStyle,
    getCardStyleClasses,
    getImageHeightClass,
    getImageAspectRatioStyle,
    getCardPaddingClass,
    formatDateTime,
    eventSlug,
    reducedMotion,
  ])

  // Render arrow buttons
  const renderArrowButtons = useCallback(() => {
    if (!showArrows || allowedSubEvents.length <= 1) return null

    return (
      <>
        <button
          onClick={goToPrevious}
          className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all z-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Previous slide"
          disabled={allowedSubEvents.length <= 1}
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <button
          onClick={goToNext}
          className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 shadow-lg transition-all z-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Next slide"
          disabled={allowedSubEvents.length <= 1}
        >
          <ChevronRight className="w-6 h-6 text-gray-700" />
        </button>
      </>
    )
  }, [showArrows, allowedSubEvents.length, goToPrevious, goToNext])

  // Render dot indicators
  const renderDotIndicators = useCallback(() => {
    if (!showDots || allowedSubEvents.length <= 1) return null

    return (
      <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Slide indicators">
        {allowedSubEvents.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              index === currentIndex
                ? 'w-8 h-2 bg-blue-600'
                : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
            }`}
            style={{
              transition: reducedMotion ? 'none' : designTokens.transitions.fast,
            }}
            aria-label={`Go to slide ${index + 1}`}
            aria-selected={index === currentIndex}
            role="tab"
          />
        ))}
      </div>
    )
  }, [showDots, allowedSubEvents.length, currentIndex, goToSlide, reducedMotion])

  // Placeholder rendering
  if (preview && (!allowedSubEvents || allowedSubEvents.length === 0)) {
    return (
      <div className="w-full py-8 px-4">
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Event Carousel</h3>
          <p className="text-sm text-gray-500 mb-4">Slideshow</p>
          <p className="text-xs text-gray-400">Create sub-events to see them displayed here</p>
        </div>
      </div>
    )
  }

  if (!preview && (!allowedSubEvents || allowedSubEvents.length === 0)) {
    return (
      <div className="w-full py-8 px-4">
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Event Carousel</h3>
          <p className="text-xs text-gray-400">No sub-events available</p>
        </div>
      </div>
    )
  }

  // Responsive container classes
  const getContainerClasses = useCallback(() => {
    const base = 'w-full py-8'
    const currentLayout = normalizedSettings.cardLayout || 'centered'
    const layoutClasses: Record<string, string> = {
      'full-width': 'px-2 sm:px-4',
      'centered': 'px-4 max-w-4xl mx-auto',
      'grid': 'px-4',
    }
    return `${base} ${layoutClasses[currentLayout]}`.trim()
  }, [normalizedSettings.cardLayout])

  // Main slideshow render
  return (
    <div 
      className={getContainerClasses()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Screen reader live region */}
      <div
        ref={liveRegionRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {autoPlay && isAutoPlaying && !isPaused && 'Carousel auto-playing'}
      </div>

      <div 
        ref={carouselRef}
        className="relative"
        role="region"
        aria-label="Event carousel"
        tabIndex={0}
      >
        {/* Slideshow container */}
        <div 
          className="relative overflow-hidden rounded-lg"
          style={{ 
            minHeight: '400px',
            transition: reducedMotion ? 'none' : designTokens.transitions.default,
          }}
        >
          {allowedSubEvents.map((subEvent, index) => renderSubEventCard(subEvent, index))}
        </div>

        {/* Navigation arrows */}
        {renderArrowButtons()}

        {/* Dot indicators */}
        {renderDotIndicators()}
      </div>
    </div>
  )
}
