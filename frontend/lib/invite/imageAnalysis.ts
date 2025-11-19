/**
 * Image analysis utilities for background image processing
 */

/**
 * Extract dominant colors from an image
 */
export async function extractDominantColors(
  imageSrc: string,
  count: number = 3
): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(['#000000'])
        return
      }

      canvas.width = 100 // Downscale for performance
      canvas.height = 100
      ctx.drawImage(img, 0, 0, 100, 100)

      const imageData = ctx.getImageData(0, 0, 100, 100)
      const pixels = imageData.data
      const colorMap = new Map<string, number>()

      // Sample pixels and count colors
      for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const a = pixels[i + 3]

        if (a < 128) continue // Skip transparent pixels

        // Quantize colors to reduce palette
        const qr = Math.floor(r / 32) * 32
        const qg = Math.floor(g / 32) * 32
        const qb = Math.floor(b / 32) * 32
        const color = `rgb(${qr},${qg},${qb})`

        colorMap.set(color, (colorMap.get(color) || 0) + 1)
      }

      // Get most common colors
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([color]) => color)

      resolve(sortedColors.length > 0 ? sortedColors : ['#000000'])
    }
    img.onerror = () => resolve(['#000000'])
    img.src = imageSrc
  })
}

/**
 * Get image dimensions and aspect ratio
 */
export function getImageDimensions(src: string): Promise<{ width: number; height: number; aspectRatio: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        aspectRatio: img.width / img.height,
      })
    }
    img.onerror = () => resolve({ width: 0, height: 0, aspectRatio: 1 })
    img.src = src
  })
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return '#000000'
  const r = parseInt(match[0])
  const g = parseInt(match[1])
  const b = parseInt(match[2])
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Crop image to specified area
 */
export function cropImage(
  imageSrc: string,
  cropArea: { x: number; y: number; width: number; height: number },
  targetWidth?: number,
  targetHeight?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Calculate scale if target dimensions provided
      const scaleX = targetWidth ? targetWidth / cropArea.width : 1
      const scaleY = targetHeight ? targetHeight / cropArea.height : 1
      const scale = Math.max(scaleX, scaleY) // Use max to maintain aspect ratio

      canvas.width = cropArea.width * scale
      canvas.height = cropArea.height * scale

      ctx.drawImage(
        img,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        canvas.width,
        canvas.height
      )

      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageSrc
  })
}

/**
 * Check if image matches recommended aspect ratio
 */
export function isRecommendedAspectRatio(aspectRatio: number): boolean {
  // Recommended: 3:4 (0.75) or 9:16 (0.5625)
  const recommendedRatios = [0.5625, 0.75] // 9:16, 3:4
  const tolerance = 0.1
  
  return recommendedRatios.some(ratio => 
    Math.abs(aspectRatio - ratio) < tolerance
  )
}

