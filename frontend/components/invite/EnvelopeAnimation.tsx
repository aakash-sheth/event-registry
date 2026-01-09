'use client'

import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useEffect, useRef } from 'react'

interface EnvelopeAnimationProps {
  children: React.ReactNode
  onAnimationComplete?: () => void
  showAnimation?: boolean
  enabled?: boolean // Config option to enable/disable
}

const ANIMATION_STORAGE_KEY = 'envelope_animation_shown'

export default function EnvelopeAnimation({ 
  children, 
  onAnimationComplete,
  showAnimation = true,
  enabled = true
}: EnvelopeAnimationProps) {
  const [animationStage, setAnimationStage] = useState<'envelope' | 'extracting' | 'splitting' | 'revealing' | 'complete'>('envelope')
  const [showContent, setShowContent] = useState(false)
  // Start with shouldShow as false to match server render (prevents hydration mismatch)
  // Will be updated in useEffect after hydration
  const [shouldShow, setShouldShow] = useState(false)
  const [isSkipped, setIsSkipped] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const animationStartedRef = React.useRef(false)

  // Helper function for subtle haptic feedback on mobile
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof window === 'undefined') return
    
    // Check if Vibration API is available (mobile browsers)
    if ('vibrate' in navigator) {
      try {
        // Check if user prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) return
        
        // Trigger subtle vibration
        navigator.vibrate(pattern)
      } catch (error) {
        // Silently fail if vibration is not supported or blocked
        console.debug('[EnvelopeAnimation] Haptic feedback not available')
      }
    }
  }

  // Mark as hydrated after first render to prevent hydration mismatch
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Check if animation should be shown (respects sessionStorage and preferences)
  // This runs AFTER hydration to prevent hydration mismatch
  useEffect(() => {
    if (!isHydrated) return // Wait for hydration
    
    if (!enabled || !showAnimation) {
      setShouldShow(false)
      setShowContent(true)
      setIsComplete(true)
      return
    }

    // SSR safety check (shouldn't be needed after hydration, but just in case)
    if (typeof window === 'undefined') {
      setShouldShow(false)
      setShowContent(true)
      setIsComplete(true)
      return
    }

    // Check URL parameter to force animation (for testing)
    const urlParams = new URLSearchParams(window.location.search)
    const forceAnimation = urlParams.get('showAnimation') === 'true'
    
    if (forceAnimation) {
      // Force show animation, clear sessionStorage
      sessionStorage.removeItem(ANIMATION_STORAGE_KEY)
      setShouldShow(true)
      setIsComplete(false)
      return
    }

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setShouldShow(false)
      setShowContent(true)
      setIsComplete(true)
      return
    }

    // Check if animation has been shown this session
    const hasBeenShown = sessionStorage.getItem(ANIMATION_STORAGE_KEY) === 'true'
    if (hasBeenShown) {
      setShouldShow(false)
      setShowContent(true)
      setIsComplete(true)
      return
    }

    // Show animation IMMEDIATELY - no delay
    // Use a small timeout to ensure state updates are processed
    setTimeout(() => {
      setShouldShow(true)
      setIsComplete(false)
    }, 0)
  }, [enabled, showAnimation, isHydrated])

  // Animation sequence - 5 seconds total, envelope splits to top/bottom
  useEffect(() => {
    // Wait for hydration before running animation
    if (!isHydrated) return
    
    // Check if we should run animation - either shouldShow is true OR we're forcing it
    const forceShow = typeof window !== 'undefined' && window.location.search.includes('showAnimation=true')
    const shouldRunAnimation = shouldShow || forceShow
    
    // Prevent re-running if animation has already started
    if (animationStartedRef.current) {
      return
    }
    
    console.log('[EnvelopeAnimation] Animation sequence check:', {
      isHydrated,
      shouldShow,
      forceShow,
      enabled,
      showAnimation,
      shouldRunAnimation,
      isSkipped,
      isComplete,
      animationStage,
      alreadyStarted: animationStartedRef.current
    })
    
    if (!shouldRunAnimation || isSkipped || isComplete) {
      if (!forceShow && !shouldShow) {
        setShowContent(true)
        if (!isComplete) setIsComplete(true)
      }
      return
    }
    
    // Mark animation as started to prevent re-running
    animationStartedRef.current = true
    
    // Reset to envelope stage to start animation (only if not already there)
    if (animationStage !== 'envelope') {
      setAnimationStage('envelope')
    }
    
    console.log('[EnvelopeAnimation] ✅ Starting animation sequence - timers will fire')

    // Stage 1: Show envelope briefly (0.5s), then go directly to splitting
    const timer1 = setTimeout(() => {
      console.log('[EnvelopeAnimation] 🎬 Stage 1: Moving to splitting stage')
      setAnimationStage('splitting')
    }, 500)

    // Stage 2: Revealing - blank screen (envelope overlay) fades out, content fades in
    // Start earlier to create overlap with splitting stage
    const timer2 = setTimeout(() => {
      console.log('[EnvelopeAnimation] 🎬 Stage 2: Moving to revealing stage - blank screen fades out')
      setAnimationStage('revealing')
      setShowContent(true) // Start showing content as overlay fades out
    }, 1500) // Start revealing at 1.5s (overlaps with splitting which runs until ~3s)

    // Stage 3: Complete - envelope overlay fully faded out, content fully visible
    const timer3 = setTimeout(() => {
      console.log('[EnvelopeAnimation] 🎬 Stage 3: Animation complete')
      setAnimationStage('complete')
      setIsComplete(true)
      // Mark as shown in session storage
      sessionStorage.setItem(ANIMATION_STORAGE_KEY, 'true')
      onAnimationComplete?.()
    }, 4000) // Complete at 4s total (0.5s envelope + 1s splitting before overlap + 2.5s overlap/revealing)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [shouldShow, isSkipped, onAnimationComplete, enabled, showAnimation, isComplete, isHydrated])

  // Skip animation on click/tap
  const handleSkip = () => {
    if (typeof window === 'undefined') return
    
    animationStartedRef.current = false // Reset so animation can restart if needed
    setIsSkipped(true)
    setShowContent(true)
    setAnimationStage('complete')
    setIsComplete(true)
    sessionStorage.setItem(ANIMATION_STORAGE_KEY, 'true')
    onAnimationComplete?.()
  }

  // Always render the container, but control visibility
  // Animation should be the FIRST thing shown, content only after completion
  // Check if we should show animation - if forced via URL or if conditions are met
  const forceShow = typeof window !== 'undefined' && window.location.search.includes('showAnimation=true')
  const isAnimationActive = forceShow || (enabled && shouldShow && !isComplete && !isSkipped)
  
  // Log animation stage changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isAnimationActive) {
      console.log('[EnvelopeAnimation] 🎭 Animation stage changed to:', animationStage)
    }
  }, [animationStage, isAnimationActive])

  // Add haptic feedback at key animation stages (mobile only)
  useEffect(() => {
    if (!isAnimationActive || !isHydrated) return
    
    switch (animationStage) {
      case 'splitting':
        // Subtle vibration when envelope starts splitting (gentle tap)
        triggerHaptic(10) // 10ms - very subtle
        break
      case 'revealing':
        // Slightly longer vibration when content reveals (gentle pulse)
        triggerHaptic([10, 20, 10]) // 10ms on, 20ms off, 10ms on - subtle double tap
        break
      case 'complete':
        // Very gentle completion vibration
        triggerHaptic(5) // 5ms - barely perceptible
        break
      default:
        break
    }
  }, [animationStage, isAnimationActive, isHydrated])

  // Debug logging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[EnvelopeAnimation] State:', {
        enabled,
        showAnimation,
        shouldShow,
        isComplete,
        isSkipped,
        isAnimationActive,
        animationStage,
        sessionStorageCheck: sessionStorage.getItem(ANIMATION_STORAGE_KEY)
      })
    }
  }, [enabled, showAnimation, shouldShow, isComplete, isSkipped, isAnimationActive, animationStage])

  return (
    <>
      {/* Animation overlay - covers everything until complete - HIGHEST Z-INDEX */}
      {/* Blank screen (envelope overlay) fades out during revealing stage */}
      <motion.div 
        className="fixed inset-0 z-[9999] bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50 cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #F5E6D3 0%, #E6D4B8 50%, #D4C4A8 100%)',
        }}
        initial={{ opacity: 1 }}
        animate={{ 
          opacity: (isAnimationActive && (animationStage === 'envelope' || animationStage === 'splitting')) ? 1 : 0,
          pointerEvents: (isAnimationActive && (animationStage === 'envelope' || animationStage === 'splitting')) ? 'auto' : 'none',
          visibility: (isAnimationActive && (animationStage === 'envelope' || animationStage === 'splitting')) ? 'visible' : 'hidden'
        }}
        transition={{ 
          duration: 2, // Fade out over 2 seconds during revealing stage
          ease: 'easeInOut'
        }}
        suppressHydrationWarning
        onClick={handleSkip}
        onTouchStart={handleSkip}
        role="button"
        aria-label="Click to skip animation"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSkip()
          }
        }}
      >
        {/* Skip hint - appears after envelope is visible */}
        {isAnimationActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute top-4 right-4 z-[10000]"
          >
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-gray-700 shadow-lg border border-gray-200">
              Click to skip
            </div>
          </motion.div>
        )}

        {/* Envelope Container - only show when animation is active */}
        {isAnimationActive && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-[10001] p-5">
            {/* Envelope Body (Bottom Part) - Moves to bottom of screen */}
            <motion.div
              key="envelope-body"
              className="absolute"
              initial={{ y: 0, rotateX: 0, opacity: 1 }}
              animate={
                animationStage === 'splitting' || animationStage === 'revealing'
                  ? { 
                      y: '100vh', // Move to bottom of screen
                      rotateX: 0, 
                      opacity: 0 
                    }
                  : { y: 0, rotateX: 0, opacity: 1 }
              }
              transition={{ 
                duration: animationStage === 'splitting' || animationStage === 'revealing' ? 2.5 : 0,
                ease: 'easeInOut',
                opacity: { duration: 2 }
              }}
              style={{
                transformStyle: 'preserve-3d',
                perspective: '1000px',
                pointerEvents: 'none'
              }}
            >
              <svg 
                viewBox="0 0 450 320" 
                className="drop-shadow-2xl" 
                style={{ 
                  display: 'block',
                  height: '45vh', // 45% of viewport height - leaves margin on edges
                  width: 'auto', // Width scales to maintain aspect ratio
                  maxWidth: 'calc(100vw - 10px)', // Prevent overflow with 20px margin on each side
                  maxHeight: 'calc(100vh - 10px)' // Prevent overflow with 20px margin on top/bottom
                }}
                preserveAspectRatio="xMidYMid meet"
              >
            <defs>
              <linearGradient id="envelopeBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2D5F4F" stopOpacity="1" />
                <stop offset="50%" stopColor="#1E4A3A" stopOpacity="1" />
                <stop offset="100%" stopColor="#2D5F4F" stopOpacity="1" />
              </linearGradient>
              <filter id="paperTexture">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
              </filter>
            </defs>
            
            {/* Envelope body - bottom part with elegant shape */}
            <path
              d="M 60 100 L 225 220 L 390 100 L 390 280 L 60 280 Z"
              fill="url(#envelopeBodyGrad)"
              stroke="#1A3D2E"
              strokeWidth="2.5"
              filter="url(#paperTexture)"
            />
            
            {/* Inner envelope highlight for depth */}
            <path
              d="M 70 110 L 225 210 L 380 110 L 380 270 L 70 270 Z"
              fill="#3A7A6A"
              opacity="0.3"
            />
            
            {/* Decorative corner detail */}
            <path
              d="M 70 110 L 85 110 L 70 125 Z"
              fill="#4A9A8A"
              opacity="0.4"
            />
            <path
              d="M 380 110 L 365 110 L 380 125 Z"
              fill="#4A9A8A"
              opacity="0.4"
            />
          </svg>
            </motion.div>

            {/* Envelope Flap (Top Part) - Moves to top of screen */}
            <motion.div
              key="envelope-flap"
              className="absolute"
              initial={{ y: 0, rotateX: 0, zIndex: 2, opacity: 1 }}
              animate={
                animationStage === 'splitting' || animationStage === 'revealing'
                  ? { 
                      y: '-100vh', // Move to top of screen
                      rotateX: 0, 
                      zIndex: 1, 
                      opacity: 0 
                    }
                  : { y: 0, rotateX: 0, zIndex: 2, opacity: 1 }
              }
              transition={{ 
                duration: animationStage === 'splitting' || animationStage === 'revealing' ? 2.5 : 0,
                ease: 'easeInOut',
                opacity: { duration: 2 }
              }}
              style={{
                transformStyle: 'preserve-3d',
                perspective: '1000px',
                pointerEvents: 'none'
              }}
            >
              <svg 
                viewBox="0 0 450 320" 
                className="drop-shadow-2xl" 
                style={{ 
                  display: 'block',
                  height: '45vh', // 45% of viewport height - leaves margin on edges
                  width: 'auto', // Width scales to maintain aspect ratio
                  maxWidth: 'calc(100vw - 40px)', // Prevent overflow with 20px margin on each side
                  maxHeight: 'calc(100vh - 40px)' // Prevent overflow with 20px margin on top/bottom
                }}
                preserveAspectRatio="xMidYMid meet"
              >
            <defs>
              <linearGradient id="envelopeFlapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3A7A6A" stopOpacity="1" />
                <stop offset="100%" stopColor="#2D5F4F" stopOpacity="1" />
              </linearGradient>
              <radialGradient id="waxSealGrad" cx="50%" cy="50%">
                <stop offset="0%" stopColor="#D4A574" stopOpacity="1" />
                <stop offset="50%" stopColor="#B8860B" stopOpacity="1" />
                <stop offset="100%" stopColor="#8B6914" stopOpacity="1" />
              </radialGradient>
              <filter id="waxGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Envelope flap - top part */}
            <path
              d="M 60 100 L 225 220 L 390 100"
              fill="url(#envelopeFlapGrad)"
              stroke="#1A3D2E"
              strokeWidth="2.5"
            />
            
            {/* Flap highlight for 3D effect */}
            <path
              d="M 70 105 L 225 210 L 380 105"
              fill="#4A9A8A"
              opacity="0.4"
            />
            
            {/* Wax Seal - Copper/Gold colored */}
            <g filter="url(#waxGlow)">
              {/* Seal shadow */}
              <circle cx="225" cy="160" r="28" fill="#8B6914" opacity="0.3" />
              
              {/* Main seal */}
              <circle cx="225" cy="160" r="26" fill="url(#waxSealGrad)" />
              
              {/* Seal highlight */}
              <ellipse cx="220" cy="155" rx="8" ry="12" fill="#E6C89A" opacity="0.6" />
              
              {/* Decorative pattern on seal - Intertwined design */}
              <g transform="translate(225, 160)">
                {/* Decorative swirls/initials placeholder */}
                <path
                  d="M -8 -6 Q 0 -10 8 -6 Q 10 0 8 6 Q 0 10 -8 6 Q -10 0 -8 -6"
                  fill="none"
                  stroke="#8B6914"
                  strokeWidth="1.5"
                  opacity="0.7"
                />
                <circle cx="0" cy="0" r="4" fill="#8B6914" opacity="0.5" />
              </g>
              
              {/* Seal texture/imperfections for realism */}
              <circle cx="218" cy="162" r="2" fill="#8B6914" opacity="0.4" />
              <circle cx="230" cy="158" r="1.5" fill="#8B6914" opacity="0.3" />
            </g>
            
            {/* Decorative stitching detail (optional, like kraft paper style) */}
            <path
              d="M 70 105 L 380 105"
              stroke="#1A3D2E"
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.3"
            />
          </svg>
            </motion.div>

            {/* Letter extraction step removed - envelope goes directly to splitting */}
          </div>
        )}
      </motion.div>

      {/* Content - fades in as blank screen (envelope overlay) fades out during revealing stage */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: (animationStage === 'revealing' || animationStage === 'complete' || isComplete) ? 1 : 0 
        }}
        transition={{ 
          duration: 2, // Fade in over 2 seconds during revealing stage (same as overlay fade out)
          ease: 'easeInOut',
          delay: 0
        }}
        className={isAnimationActive && (animationStage === 'envelope' || animationStage === 'splitting') ? 'pointer-events-none' : ''}
        style={{ height: 'fit-content', minHeight: 'auto' }}
      >
        {children}
      </motion.div>
    </>
  )
}

