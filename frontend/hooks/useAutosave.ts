import { useEffect, useRef } from 'react'
import { InviteConfig } from '@/lib/invite/schema'

interface UseAutosaveProps {
  config: InviteConfig
  onSave: (config: InviteConfig) => Promise<void>
  delay?: number
  enabled?: boolean
}

export function useAutosave({ config, onSave, delay = 1500, enabled = true }: UseAutosaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  useEffect(() => {
    if (!enabled) return

    const configString = JSON.stringify(config)
    
    // Skip if config hasn't changed
    if (configString === lastSavedRef.current) {
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(config)
        lastSavedRef.current = configString
      } catch (error) {
        console.error('Autosave failed:', error)
      }
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [config, onSave, delay, enabled])

  // Manual save function
  const saveNow = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    try {
      await onSave(config)
      lastSavedRef.current = JSON.stringify(config)
    } catch (error) {
      console.error('Manual save failed:', error)
      throw error
    }
  }

  return { saveNow }
}

