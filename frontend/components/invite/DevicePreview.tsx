'use client'

import React from 'react'

interface DevicePreviewProps {
  imageSrc: string
  cropArea: { x: number; y: number; width: number; height: number }
  imageDimensions: { width: number; height: number }
  aspectRatio: number
  zoom: number
  focusPoint?: { x: number; y: number }
}

const DEVICES = [
  { name: 'Mobile', width: 375, height: 667, aspectRatio: 667/375 }, // iPhone
  { name: 'Tablet', width: 768, height: 1024, aspectRatio: 1024/768 }, // iPad
  { name: 'Desktop', width: 1920, height: 1080, aspectRatio: 1080/1920 }, // Desktop
]

export default function DevicePreview({
  imageSrc,
  cropArea,
  imageDimensions,
  aspectRatio,
  zoom,
  focusPoint,
}: DevicePreviewProps) {
  // Calculate how the cropped image will appear on each device
  const getDevicePreview = (device: typeof DEVICES[0]) => {
    // Calculate what part of the cropped image will be visible
    const croppedAspectRatio = cropArea.width / cropArea.height
    const deviceAspectRatio = device.aspectRatio
    
    let visibleWidth: number
    let visibleHeight: number
    let offsetX = 0
    let offsetY = 0
    
    if (croppedAspectRatio > deviceAspectRatio) {
      // Cropped image is wider than device - device will show full height
      visibleHeight = cropArea.height
      visibleWidth = visibleHeight * deviceAspectRatio
      offsetX = (cropArea.width - visibleWidth) / 2
    } else {
      // Cropped image is taller than device - device will show full width
      visibleWidth = cropArea.width
      visibleHeight = visibleWidth / deviceAspectRatio
      offsetY = (cropArea.height - visibleHeight) / 2
    }
    
    // Apply focus point if provided
    if (focusPoint) {
      const focusX = (focusPoint.x / 100) * cropArea.width
      const focusY = (focusPoint.y / 100) * cropArea.height
      
      // Adjust offset to center focus point
      offsetX = Math.max(0, Math.min(
        cropArea.width - visibleWidth,
        focusX - visibleWidth / 2
      ))
      offsetY = Math.max(0, Math.min(
        cropArea.height - visibleHeight,
        focusY - visibleHeight / 2
      ))
    }
    
    return {
      ...device,
      visibleArea: {
        x: cropArea.x + offsetX,
        y: cropArea.y + offsetY,
        width: visibleWidth,
        height: visibleHeight,
      },
      scale: Math.min(device.width / visibleWidth, device.height / visibleHeight),
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {DEVICES.map(device => {
        const preview = getDevicePreview(device)
        const scale = preview.scale
        
        return (
          <div key={device.name} className="text-center">
            <div className="text-xs font-medium text-gray-600 mb-1">{device.name}</div>
            <div
              className="border-2 border-gray-300 rounded bg-gray-100 mx-auto overflow-hidden"
              style={{
                width: `${device.width * 0.15}px`,
                height: `${device.height * 0.15}px`,
                aspectRatio: device.aspectRatio,
              }}
            >
              <div
                className="relative w-full h-full"
                style={{
                  backgroundImage: `url(${imageSrc})`,
                  backgroundSize: `${(imageDimensions.width * scale * zoom) / device.width * 100}%`,
                  backgroundPosition: `${((preview.visibleArea.x - cropArea.x) / cropArea.width) * 100}% ${((preview.visibleArea.y - cropArea.y) / cropArea.height) * 100}%`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}


