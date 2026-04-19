'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { InviteConfig } from '@/lib/invite/schema'
import { getInvitePageLayout } from '@/lib/invite/api'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import {
  PREVIEW_SAMPLE,
  enrichConfigWithSampleData,
} from '@/components/invite/PageLayoutCardPreview'
import { logError } from '@/lib/error-handler'

/**
 * Full-screen template preview page.
 * Opens in a new tab from the Page Layout Studio edit page and stays in sync via
 * BroadcastChannel (`pageLayout-preview-${layoutId}`).
 * Auth is enforced by the parent layout.tsx at /host/page-layouts/.
 */
export default function PageLayoutPreviewPage() {
  const params = useParams()
  const layoutId = params.layoutId ? parseInt(params.layoutId as string) : null

  const [config, setConfig] = useState<InviteConfig | null>(null)
  const [templateName, setTemplateName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch to populate the preview even before the edit page broadcasts
  useEffect(() => {
    if (!layoutId || isNaN(layoutId)) {
      setError('Invalid layout ID.')
      setLoading(false)
      return
    }

    getInvitePageLayout(layoutId)
      .then((template) => {
        setTemplateName(template.name ?? '')
        // Prefer config stashed by the editor at click-time (reflects unsaved changes);
        // fall back to the API response if nothing was stashed.
        const stashKey = `pageLayout-preview-config-${layoutId}`
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
        logError('Preview: load page layout failed', e)
        setError('Could not load page layout.')
      })
      .finally(() => setLoading(false))
  }, [layoutId])

  // BroadcastChannel listener — receives live config updates from the edit page
  useEffect(() => {
    if (!layoutId || isNaN(layoutId)) return

    const channel = new BroadcastChannel(`pageLayout-preview-${layoutId}`)
    channel.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'PAGE_LAYOUT_CONFIG_UPDATE') {
        setConfig(e.data.config as InviteConfig)
      }
    })

    return () => {
      channel.close()
    }
  }, [layoutId])

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
        <p className="text-gray-600">{error ?? 'Page layout config unavailable.'}</p>
        {layoutId && (
          <Link
            href={`/host/page-layouts/${layoutId}/edit`}
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
          {templateName || 'Page Layout Preview'}
        </span>

        <div className="flex items-center gap-4 shrink-0">
          {/* Live indicator */}
          <span className="flex items-center gap-1.5 text-xs text-green-200">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-300" aria-hidden />
            Live
          </span>

          {/* Back link */}
          {layoutId && (
            <Link
              href={`/host/page-layouts/${layoutId}/edit`}
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
