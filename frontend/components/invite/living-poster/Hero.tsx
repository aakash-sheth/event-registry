'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Theme } from '@/lib/invite/themes'
import { InviteConfig } from '@/lib/invite/schema'
import Countdown from './Countdown'
import ActionButtons from './ActionButtons'

interface HeroProps {
  config: InviteConfig
  theme: Theme
  eventSlug: string
  eventDate?: string
  showBadge?: boolean
}

export default function Hero({ config, theme, eventSlug, eventDate, showBadge = true }: HeroProps) {
  const { hero } = config
  const background = hero?.background

  // Get responsive position based on focus point or position setting
  const getResponsivePosition = (position: string, focusPoint?: { x: number; y: number }) => {
    if (focusPoint) {
      // Use focus point for precise positioning (0-100% format)
      return `${focusPoint.x}% ${focusPoint.y}%`
    }
    
    // Fallback to position setting
    const positionMap: Record<string, string> = {
      center: 'center',
      top: 'center top',
      bottom: 'center bottom',
      left: 'left center',
      right: 'right center',
    }
    return positionMap[position] || 'center'
  }

  // Background rendering
  const renderBackground = () => {
    if (!background) {
      return (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${theme.palette.bg} 0%, ${theme.palette.primary}20 100%)`,
          }}
        />
      )
    }

    switch (background.type) {
      case 'image':
        if (background.src) {
          const imageBg = background as any // Type assertion for background adjustments
          const fitMode = imageBg.fitMode || 'cover'
          const bgColor = imageBg.backgroundColor || '#000000'
          const position = imageBg.position || 'center'
          const focusPoint = imageBg.focusPoint
          const objectPosition = getResponsivePosition(position, focusPoint)
          
          // Picture-in-picture mode
          if (fitMode === 'picture-in-picture') {
            return (
              <>
                {/* Blurred/stretched background */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${background.src})`,
                    backgroundSize: 'cover',
                    backgroundPosition: objectPosition,
                    filter: 'blur(20px) brightness(0.7)',
                    transform: 'scale(1.1)', // Slight zoom to hide blur edges
                  }}
                />
                {/* Solid color overlay */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundColor: bgColor,
                    opacity: 0.3,
                  }}
                />
                {/* Original image centered */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className="relative"
                    style={{
                      width: '90%',
                      maxWidth: '600px',
                      aspectRatio: imageBg.originalAspectRatio 
                        ? `${imageBg.originalAspectRatio.width} / ${imageBg.originalAspectRatio.height}`
                        : '4/3',
                    }}
                  >
                    {background.src.startsWith('data:') ? (
                      <img
                        src={background.src}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain rounded-lg shadow-2xl"
                      />
                    ) : (
                      <Image
                        src={background.src}
                        alt=""
                        fill
                        className="object-contain rounded-lg shadow-2xl"
                        quality={95}
                        sizes="(max-width: 600px) 90vw, 600px"
                      />
                    )}
                  </div>
                </div>
              </>
            )
          }
          
          // Blur fill mode
          if (fitMode === 'blur-fill') {
            return (
              <>
                {/* Blurred background - no scale to prevent overflow */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${background.src})`,
                    backgroundSize: 'cover',
                    backgroundPosition: objectPosition,
                    filter: 'blur(30px)',
                  }}
                />
                {/* Solid color overlay */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundColor: bgColor,
                    opacity: 0.5,
                  }}
                />
              </>
            )
          }
          
          // Contain mode
          if (fitMode === 'contain') {
            return (
              <>
                {/* Solid background */}
                <div 
                  className="absolute inset-0"
                  style={{ backgroundColor: bgColor }}
                />
                {/* Image contained */}
                <div className="absolute inset-0">
                  {background.src.startsWith('data:') ? (
                    <img
                      src={background.src}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <Image
                      src={background.src}
                      alt=""
                      fill
                      className="object-contain"
                      quality={90}
                      sizes="100vw"
                    />
                  )}
                </div>
              </>
            )
          }
          
          // Default cover mode (existing behavior)
          // Use regular img tag for base64 data URLs, Next.js Image for regular URLs
          const isBase64 = background.src.startsWith('data:')
          
          if (isBase64) {
            return (
              <div className="absolute inset-0">
                <img
                  src={background.src}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    objectPosition: objectPosition,
                  }}
                />
              </div>
            )
          }
          
          return (
            <div className="absolute inset-0">
              <Image
                src={background.src}
                alt=""
                fill
                priority
                className="object-cover"
                style={{
                  objectPosition: position,
                }}
                sizes="100vw"
                quality={90}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
            </div>
          )
        }
        break

      case 'video':
        if (background.src) {
          return (
            <div className="absolute inset-0">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                <source src={background.src} type="video/mp4" />
              </video>
            </div>
          )
        }
        break

      case 'gradient':
        return (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${background.gradientFrom || theme.palette.bg} 0%, ${background.gradientTo || theme.palette.primary} 100%)`,
            }}
          />
        )
    }

    return null
  }

  return (
    <section
      className="relative flex flex-col items-center justify-center px-4 py-safe overflow-hidden"
      style={{
        fontFamily: theme.fonts.body,
        // Fill container height, but ensure minimum viewport height on public page
        height: '100%',
        minHeight: '100svh',
      }}
    >
      {/* Background */}
      {renderBackground()}

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${theme.palette.overlayOpacity})`,
        }}
      />

      {/* Event Type Badge - Top Left Corner (Fixed Position) */}
      {showBadge && hero?.eventType && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed top-4 left-4 md:top-6 md:left-6 z-50"
        >
          <span
            className="inline-block px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md shadow-lg"
            style={{
              backgroundColor: `rgba(255, 255, 255, 0.25)`,
              color: theme.palette.fg,
              border: `1px solid rgba(255, 255, 255, 0.4)`,
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            {hero.eventType}
          </span>
        </motion.div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto text-center">
        {/* Centered Content Stack */}
        <div className="flex flex-col items-center justify-center space-y-6 md:space-y-8">
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-[clamp(28px,7vw,56px)] font-bold leading-tight max-w-[26ch]"
            style={{
              fontFamily: theme.fonts.title,
              color: theme.palette.fg,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {hero?.title || 'Event'}
          </motion.h1>

          {/* Subtitle */}
          {hero?.subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-[clamp(16px,4vw,20px)] max-w-[22ch]"
              style={{
                color: theme.palette.muted,
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              {hero.subtitle}
            </motion.p>
          )}

          {/* Countdown Timer */}
          {hero?.showTimer && hero?.eventDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Countdown 
                targetDate={new Date(hero.eventDate)} 
                theme={theme}
                eventSlug={eventSlug}
                eventTitle={hero?.title || 'Event'}
              />
            </motion.div>
          )}

          {/* Action Buttons */}
          {hero?.buttons && hero.buttons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="w-full max-w-md"
            >
              <ActionButtons
                buttons={hero.buttons}
                theme={theme}
                eventSlug={eventSlug}
                eventDate={eventDate || hero.eventDate}
                eventTitle={hero.title || 'Event'}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll Hint */}
      {config.descriptionMarkdown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center space-y-2">
            <span
              className="text-sm"
              style={{ color: theme.palette.fg }}
            >
              Scroll for more
            </span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: theme.palette.fg }}
              >
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </motion.div>
          </div>
        </motion.div>
      )}
    </section>
  )
}

