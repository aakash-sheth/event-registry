'use client'

import React from 'react'
import { TextureType } from '@/lib/invite/schema'

interface TextureOverlayProps {
  type: TextureType
  intensity?: number // 0-100, default 20
}

/**
 * CSS-based texture overlay that sits underneath all content
 * Acts like printing on textured paper - the texture is part of the background
 */
export default function TextureOverlay({ type, intensity = 40 }: TextureOverlayProps) {
  if (type === 'none') {
    return null
  }

  const opacity = intensity / 100

  // Base styles for all textures
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1, // Behind all content but above background
    opacity,
    // No blend mode - use direct opacity for better visibility
  }

  // Texture-specific styles
  const getTextureStyle = (): React.CSSProperties => {
    switch (type) {
      case 'paper-grain':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.4) 0px,
              transparent 0.5px,
              transparent 1.5px,
              rgba(0, 0, 0, 0.4) 2px,
              transparent 2.5px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.4) 0px,
              transparent 0.5px,
              transparent 1.5px,
              rgba(0, 0, 0, 0.4) 2px,
              transparent 2.5px
            )
          `,
          backgroundSize: '3px 3px',
        }

      case 'linen':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              rgba(0, 0, 0, 0.25) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.25) 3px,
              transparent 4px
            ),
            repeating-linear-gradient(
              -45deg,
              rgba(0, 0, 0, 0.25) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.25) 3px,
              transparent 4px
            )
          `,
          backgroundSize: '8px 8px',
        }

      case 'canvas':
        return {
          ...baseStyle,
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.5) 0.5px, transparent 0.5px),
            radial-gradient(circle at 2px 2px, rgba(0, 0, 0, 0.3) 0.5px, transparent 0.5px),
            radial-gradient(circle at 3px 3px, rgba(0, 0, 0, 0.4) 0.5px, transparent 0.5px)
          `,
          backgroundSize: '4px 4px',
        }

      case 'parchment':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(139, 90, 43, 0.3) 0px,
              transparent 1px,
              transparent 2px,
              rgba(139, 90, 43, 0.3) 3px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(139, 90, 43, 0.3) 0px,
              transparent 1px,
              transparent 2px,
              rgba(139, 90, 43, 0.3) 3px
            ),
            radial-gradient(circle at 50% 50%, rgba(139, 90, 43, 0.15) 0%, transparent 50%)
          `,
          backgroundSize: '6px 6px, 6px 6px, 20px 20px',
        }

      case 'vintage-paper':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(101, 67, 33, 0.35) 0px,
              transparent 1px,
              transparent 3px,
              rgba(101, 67, 33, 0.35) 4px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(101, 67, 33, 0.35) 0px,
              transparent 1px,
              transparent 3px,
              rgba(101, 67, 33, 0.35) 4px
            ),
            radial-gradient(circle at 2px 2px, rgba(101, 67, 33, 0.2) 1px, transparent 0)
          `,
          backgroundSize: '8px 8px, 8px 8px, 4px 4px',
        }

      case 'silk':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.2) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.2) 3px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.25) 0px,
              transparent 1px,
              transparent 2px,
              rgba(255, 255, 255, 0.25) 3px
            )
          `,
          backgroundSize: '2px 2px',
        }

      case 'marble':
        return {
          ...baseStyle,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(0, 0, 0, 0.25) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.25) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.15) 0%, transparent 50%),
            repeating-linear-gradient(
              45deg,
              rgba(0, 0, 0, 0.15) 0px,
              transparent 2px,
              transparent 4px,
              rgba(0, 0, 0, 0.15) 6px
            )
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 10px 10px',
        }

      default:
        return baseStyle
    }
  }

  const textureStyle = getTextureStyle()
  
  return <div style={textureStyle} aria-hidden="true" data-texture-type={type} />
}
