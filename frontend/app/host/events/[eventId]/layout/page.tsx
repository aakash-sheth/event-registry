'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import TemplateLibrary from '@/components/invite/TemplateLibrary'
import {
  getInviteDesignTemplates,
  getInvitePage,
  createInvitePage,
  updateInvitePage,
} from '@/lib/invite/api'
import { applyTemplate } from '@/lib/invite/applyTemplate'
import type { InviteTemplate } from '@/lib/invite/templates'
import type { ImageTileSettings, TextOverlay, InviteConfig } from '@/lib/invite/schema'
import { updateEventPageConfig } from '@/lib/event/api'
import api from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventData {
  id: number
  title: string
  date?: string
  city?: string
}

/**
 * Applies the card designer's background URL + text boxes to the invite config.
 * Sets the image tile src, fitMode, and textOverlays directly on the ImageTile.
 * Coordinates are stored with the same 9:16 system as the card designer canvas —
 * no translation needed.
 */
function applyCardDesignToConfig(
  config: InviteConfig,
  bgUrl: string | null,
  bgGradient: string | null,
  textBoxes: TextOverlay[] | null,
): InviteConfig {
  if (!config.tiles) return config
  const updatedTiles = config.tiles.map((t) =>
    t.type === 'image'
      ? {
          ...t,
          settings: {
            ...(t.settings as ImageTileSettings),
            src: bgUrl ?? undefined,
            backgroundGradient: bgUrl ? undefined : (bgGradient ?? undefined),
            fitMode: 'full-image' as const,
            textOverlays: textBoxes ?? undefined,
          },
        }
      : t
  )
  return { ...config, tiles: updatedTiles }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LayoutSelectPage(): React.ReactElement {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  const eventId = params.eventId ? parseInt(params.eventId as string, 10) : 0

  const [templates, setTemplates] = useState<InviteTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)

  // Load templates and event data in parallel
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return

    Promise.all([
      getInviteDesignTemplates().catch(() => [] as InviteTemplate[]),
      api.get<EventData>(`/api/events/${eventId}/`).catch(() => null),
    ]).then(([tmplList, eventRes]) => {
      setTemplates(tmplList)
      if (eventRes) setEvent(eventRes.data)
    }).finally(() => setTemplatesLoading(false))
  }, [eventId])

  function readCardDesignFromStorage(): { bgUrl: string | null; bgGradient: string | null; textBoxes: TextOverlay[] | null } {
    const bgUrl = localStorage.getItem(`card-bg-${eventId}`)
    const bgGradient = localStorage.getItem(`card-gradient-${eventId}`)
    let textBoxes: TextOverlay[] | null = null
    try {
      const raw = localStorage.getItem(`card-textboxes-${eventId}`)
      if (raw) textBoxes = JSON.parse(raw) as TextOverlay[]
    } catch { /* ignore parse errors */ }
    return { bgUrl, bgGradient, textBoxes }
  }

  async function handleTemplateSelect(templateId: string): Promise<void> {
    const template = templates.find((t) => t.id === templateId)
    if (!template) {
      showToast('Template not found.', 'error')
      return
    }

    setApplying(true)
    setApplyingId(templateId)
    try {
      let appliedConfig = applyTemplate(template.config, {
        title: event?.title,
        date: event?.date,
        city: event?.city,
      })

      // Apply card designer background + text overlays from step 2
      const { bgUrl, bgGradient, textBoxes } = readCardDesignFromStorage()
      if (bgUrl || bgGradient) {
        appliedConfig = applyCardDesignToConfig(appliedConfig, bgUrl, bgGradient, textBoxes)
      }

      // Save to Event.page_config so the design page reads the template + card bg
      await updateEventPageConfig(eventId, appliedConfig)

      // Also sync to InvitePage model for publish flow
      const existing = await getInvitePage(eventId)
      if (existing) {
        await updateInvitePage(eventId, { config: appliedConfig })
      } else {
        await createInvitePage(eventId, { config: appliedConfig })
      }

      showToast('Template applied! Customize it on the next step.', 'success')
      router.push(`/host/events/${eventId}/design`)
    } catch (err: unknown) {
      logError('Failed to apply template:', err)
      showToast(getErrorMessage(err), 'error')
    } finally {
      setApplying(false)
      setApplyingId(null)
    }
  }

  async function handleBlankCanvas(): Promise<void> {
    const { bgUrl, bgGradient, textBoxes } = readCardDesignFromStorage()
    if (bgUrl || bgGradient) {
      setApplying(true)
      setApplyingId('blank')
      try {
        const existing = await getInvitePage(eventId)
        const baseConfig = existing?.config
        if (baseConfig) {
          const updated = applyCardDesignToConfig(baseConfig, bgUrl, bgGradient, textBoxes)
          await updateEventPageConfig(eventId, updated)
          await updateInvitePage(eventId, { config: updated })
        }
      } catch {
        // Non-fatal — design page will still open correctly
      } finally {
        setApplying(false)
        setApplyingId(null)
      }
    }
    router.push(`/host/events/${eventId}/design`)
  }

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <p className="text-red-500">Invalid event ID.</p>
      </div>
    )
  }

  const pendingTemplate = templates.find((t) => t.id === pendingTemplateId)

  return (
    <div className="min-h-screen bg-eco-beige pb-24">
      <WizardProgress currentStep={3} eventId={eventId} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push(`/host/events/${eventId}/card`)}
          className="flex items-center gap-1 text-sm text-eco-green hover:underline mb-6"
        >
          <span aria-hidden>&#8592;</span> Back to Greeting Card
        </button>

        <h1 className="text-3xl font-bold text-eco-green mb-1">Choose your invite layout</h1>
        <p className="text-gray-600 mb-8 text-sm">
          Pick a starting point. You can customize everything on the next step.
        </p>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-eco-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`relative transition-opacity duration-200 ${applying ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Inline spinner centred over the grid while applying */}
            {applying && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-24 gap-3">
                <div className="w-10 h-10 border-4 border-eco-green border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-eco-green bg-white/80 px-3 py-1 rounded-full">
                  {applyingId === 'blank' ? 'Opening canvas...' : 'Applying template...'}
                </p>
              </div>
            )}

            {/* Templates grid with blank canvas as first item */}
            <TemplateLibrary
              templates={templates}
              onSelect={setPendingTemplateId}
              selectedId={pendingTemplateId ?? undefined}
              onBlankCanvas={handleBlankCanvas}
            />
          </div>
        )}
      </div>

      {/* Sticky apply bar */}
      {pendingTemplate && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-gray-800 truncate">
              <span className="text-gray-500 font-normal">Selected: </span>{pendingTemplate.name}
            </p>
            <div className="flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setPendingTemplateId(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => handleTemplateSelect(pendingTemplate.id)}
                className="bg-eco-green hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {applying ? 'Applying...' : 'Apply template →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
