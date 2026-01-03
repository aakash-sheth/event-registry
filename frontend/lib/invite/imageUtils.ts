/**
 * Image utility functions for handling image dimensions and display optimization
 * Extracted from ImageTile component for reuse across the application
 */

export interface ImageDimensions {
  width: number
  height: number
  aspectRatio: number
}

/**
 * Load image and get its dimensions and aspect ratio
 * Extracted from ImageTile.tsx lines 25-36
 * @param imageUrl - URL of the image to load
 * @returns Promise resolving to image dimensions
 */
export const getImageDimensions = (imageUrl: string): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const aspectRatio = img.width / img.height
      resolve({
        width: img.width,
        height: img.height,
        aspectRatio,
      })
    }
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`))
    }
    img.src = imageUrl
  })
}

/**
 * Calculate optimal display dimensions while maintaining aspect ratio
 * Prevents images from breaking layout by scaling down if needed
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @returns Calculated width and height that fit within constraints
 */
export const calculateOptimalDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const aspectRatio = originalWidth / originalHeight
  let width = originalWidth
  let height = originalHeight

  // Scale down if exceeds max dimensions
  if (width > maxWidth) {
    width = maxWidth
    height = width / aspectRatio
  }
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }

  return { width, height }
}

/**
 * Get recommended dimensions for carousel images based on settings
 * @param imageHeight - Height setting: 'small', 'medium', 'large', or 'full'
 * @param aspectRatio - Aspect ratio setting: '16:9', '4:3', '1:1', or 'auto'
 * @returns Recommended max width and height for the image
 */
export const getRecommendedCarouselDimensions = (
  imageHeight: 'small' | 'medium' | 'large' | 'full' = 'medium',
  aspectRatio: '16:9' | '4:3' | '1:1' | 'auto' = '16:9'
): { maxWidth: number; maxHeight: number } => {
  const baseDimensions = {
    small: { width: 800, height: 600 },
    medium: { width: 1000, height: 700 },
    large: { width: 1200, height: 800 },
    full: { width: 1400, height: 900 },
  }
  
  const base = baseDimensions[imageHeight]
  
  // Adjust based on aspect ratio
  if (aspectRatio === '16:9') {
    return {
      maxWidth: base.width,
      maxHeight: Math.round(base.width * (9 / 16)),
    }
  } else if (aspectRatio === '4:3') {
    return {
      maxWidth: base.width,
      maxHeight: Math.round(base.width * (3 / 4)),
    }
  } else if (aspectRatio === '1:1') {
    return {
      maxWidth: base.width,
      maxHeight: base.width,
    }
  }
  
  // Auto or default - use base dimensions
  return {
    maxWidth: base.width,
    maxHeight: base.height,
  }
}

