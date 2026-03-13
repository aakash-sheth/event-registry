'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { InviteConfig } from '@/lib/invite/schema'
import { getInviteDesignTemplate } from '@/lib/invite/api'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import {
  PREVIEW_SAMPLE,
  enrichConfigWithSampleData,
} from '@/components/invite/TemplateCardPreview'
import { logError } from '@/lib/error-handler'

/**
 * Full-screen template preview page.
 * Opens in a new tab from the Template Studio edit page and stays in sync via
 * BroadcastChannel (`template-preview-${templateId}`).
 * Auth is enforced by the parent layout.tsx at /host/templates/.
 */
export default function TemplatePreviewPage() {
  const params = useParams()
  const templateId = params.templateId ? parseInt(params.templateId as string) : null

  const [config, setConfig] = useState<InviteConfig | null>(null)
  const [templateName, setTemplateName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch to populate the preview even before the edit page broadcasts
  useEffect(() => {
    if (!templateId || isNaN(templateId)) {
      setError('Invalid template ID.')
      setLoading(false)
      return
    }

    getInviteDesignTemplate(templateId)
      .then((template) => {
        setTemplateName(template.name ?? '')
        // Prefer config stashed by the editor at click-time (reflects unsaved changes);
        // fall back to the API response if nothing was stashed.
        const stashKey = `template-preview-config-${templateId}`
        const stashed = localStorage.getItem(stashKey)
        if (stashed) {
          try {
            setConfig(JSON.parse(stashed) as InviteConfig)
          } catch {
            setConfig(template.config as InviteConfig)
          }
          localStorage.removeItem(stashKey)
        } else {
          setConfig(
            template.config && typeof template.config === 'object'
              ? (template.config as InviteConfig)
              : null,
          )
        }
      })
      .catch((e: unknown) => {
        logError('Preview: load template failed', e)
        setError('Could not load template.')
      })
      .finally(() => setLoading(false))
  }, [templateId])

  // BroadcastChannel listener — receives live config updates from the edit page
  useEffect(() => {
    if (!templateId || isNaN(templateId)) return

    const channel = new BroadcastChannel(`template-preview-${templateId}`)
    channel.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'TEMPLATE_CONFIG_UPDATE') {
        setConfig(e.data.config as InviteConfig)
      }
    })

    return () => {
      channel.close()
    }
  }, [templateId])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading preview…</p>
      </div>
    )
  }

  // Error / not found
  if (error || !config) {
    return (
      <div className="min-h-screen bg-eco-beige flex flex-col items-center justify-center gap-3">
        <p className="text-gray-600">{error ?? 'Template config unavailable.'}</p>
        {templateId && (
          <Link
            href={`/host/templates/${templateId}/edit`}
            className="text-eco-green underline text-sm"
          >
            Back to editing
          </Link>
        )}
      </div>
    )
  }

  const enrichedConfig = enrichConfigWithSampleData(config)

  return (
    <div className="min-h-screen">
      {/* Fixed top banner */}
      <div className="fixed top-0 left-0 right-0 z-50 h-10 bg-eco-green flex items-center justify-between px-4">
        <span className="text-white text-sm font-medium truncate mr-4">
          {templateName || 'Template Preview'}
        </span>

        <div className="flex items-center gap-4 shrink-0">
          {/* Live indicator */}
          <span className="flex items-center gap-1.5 text-xs text-green-200">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-300" aria-hidden />
            Live
          </span>

          {/* Back link */}
          {templateId && (
            <Link
              href={`/host/templates/${templateId}/edit`}
              className="text-sm text-white hover:text-green-200 transition-colors"
            >
              &larr; Back to editing
            </Link>
          )}
        </div>
      </div>

      {/* Full-size invite render, offset below the banner */}
      <div className="pt-10">
        <LivingPosterPage
          config={enrichedConfig}
          eventSlug="preview"
          eventDate={PREVIEW_SAMPLE.dateDisplay}
          hasRsvp={true}
          hasRegistry={true}
          allowedSubEvents={[]}
        />
      </div>
    </div>
  )
}
