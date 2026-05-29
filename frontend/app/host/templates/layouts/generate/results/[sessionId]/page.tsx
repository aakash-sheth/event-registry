'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { flushSync } from 'react-dom'
import { CheckCircle2, AlertTriangle, Trash2, ExternalLink, Eye, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageLayoutCardPreview from '@/components/invite/PageLayoutCardPreview'
import {
  bulkPublishPageLayouts,
  publishPageLayout,
  rejectPageLayout,
  remixPageLayouts,
  saveReviewDrafts,
  type GenerateLayoutDraft,
  type GenerateLayoutResponse,
} from '@/lib/invite/auto-generator-api'
import { logError } from '@/lib/error-handler'

/** JSX text nodes do not honor JS \\u escapes — use middot (·) explicitly */
const MIDDOT = '\u00b7'
const LOADING_TAIL = '\u2026'

function normalizeDynamicParam(val: string | string[] | undefined): string | undefined {
  if (val == null) return undefined
  return Array.isArray(val) ? val[0] : val
}

interface MeResponse {
  id: number
  is_superuser?: boolean
  llm_module_access?: boolean
}

type DraftState = 'pending' | 'published' | 'rejected'

interface DraftRow extends GenerateLayoutDraft {
  state: DraftState
  selected: boolean
}

function draftRowKey(d: DraftRow, sessionId: string): string {
  if (d.id != null && Number.isFinite(Number(d.id))) return `id-${d.id}`
  return `preview-${sessionId}-${d.index}`
}

export default function GenerateResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = normalizeDynamicParam(
    params.sessionId as string | string[] | undefined,
  )

  const [authChecked, setAuthChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [response, setResponse] = useState<GenerateLayoutResponse | null>(null)
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [remixLockSource, setRemixLockSource] = useState<DraftRow | null>(null)
  const [remixLocks, setRemixLocks] = useState<{ recipe: boolean; preset: boolean; tone: boolean }>({
    recipe: false,
    preset: true,
    tone: false,
  })
  const [remixCount, setRemixCount] = useState(8)
  const [remixBusy, setRemixBusy] = useState(false)
  const [remixError, setRemixError] = useState<string | null>(null)
  const [saveReviewBusy, setSaveReviewBusy] = useState(false)
  const [saveReviewError, setSaveReviewError] = useState<string | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) {
      router.push('/host/login')
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const meRes = await api.get<MeResponse>('/api/auth/me/')
        if (cancelled) return
        const me = meRes.data
        if (me?.is_superuser !== true && me?.llm_module_access !== true) {
          router.push('/host/dashboard')
          return
        }
        setAllowed(true)
        if (!sessionId) {
          setError('Missing session id.')
          return
        }
        const raw = sessionStorage.getItem(`page-layouts-generate-${sessionId}`)
        if (!raw) {
          setError(
            'No results found in this browser session. Run a new generation, or open the latest drafts in the Page Layout Studio.',
          )
          return
        }
        try {
          const parsed = JSON.parse(raw) as GenerateLayoutResponse
          setResponse(parsed)
          setDrafts(
            parsed.drafts.map((d) => ({
              ...d,
              id: typeof d.id === 'number' && d.id > 0 ? d.id : null,
              persisted: Boolean(d.persisted ?? (typeof d.id === 'number' && d.id > 0)),
              state: 'pending' as const,
              selected: false,
            })),
          )
        } catch (err) {
          logError('Failed to parse generation result from sessionStorage', err)
          setError('Stored generation result was malformed. Run a new generation.')
        }
      } catch (err: any) {
        if (cancelled) return
        if (err?.response?.status === 401) router.push('/host/login')
        else router.push('/host/dashboard')
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }
    run()
    return () => { cancelled = true }
  }, [router, sessionId])

  const selectedPendingDrafts = useMemo(
    () => drafts.filter((d) => d.selected && d.state === 'pending'),
    [drafts],
  )

  /** Studio list supports ?card_url=… so we only see layouts tied to this generation’s card */
  const studioListHref = useMemo(() => {
    const cu = response?.card_url?.trim()
    if (!cu) return '/host/page-layouts'
    return `/host/page-layouts?card_url=${encodeURIComponent(cu)}`
  }, [response?.card_url])

  const rowBusyKey = (d: DraftRow) => draftRowKey(d, sessionId || '')

  const setBusyRow = (d: DraftRow, busy: boolean) =>
    setBusyKeys((prev) => {
      const k = rowBusyKey(d)
      const next = new Set(prev)
      if (busy) next.add(k)
      else next.delete(k)
      return next
    })

  const onPublishOne = async (draft: DraftRow) => {
    if (draft.id == null || draft.id <= 0) return
    const id = draft.id
    setBusyRow(draft, true)
    try {
      await publishPageLayout(id, { visibility: 'public' })
      setDrafts((rows) => rows.map((r) => (r.id === id ? { ...r, state: 'published' } : r)))
    } catch (err: any) {
      logError('Publish single failed', err)
      alert(err?.response?.data?.error || 'Failed to publish.')
    } finally {
      setBusyRow(draft, false)
    }
  }

  const onRejectOrRemove = async (draft: DraftRow) => {
    const sid = sessionId || ''
    const key = draftRowKey(draft, sid)
    if (draft.id == null || draft.id <= 0) {
      if (!confirm('Remove this preview from the list? It was not saved to the studio yet.')) return
      setDrafts((rows) => rows.filter((r) => draftRowKey(r, sid) !== key))
      return
    }
    if (!confirm('Reject this draft? It will be deleted from the studio.')) return
    setBusyRow(draft, true)
    try {
      await rejectPageLayout(draft.id)
      setDrafts((rows) => rows.map((r) => (r.id === draft.id ? { ...r, state: 'rejected' } : r)))
    } catch (err: any) {
      logError('Reject single failed', err)
      alert(err?.response?.data?.error || 'Failed to reject.')
    } finally {
      setBusyRow(draft, false)
    }
  }

  const onSaveReview = async () => {
    if (!response || !sessionId) return
    const { card_url, event_type } = response
    if (!card_url?.trim() || !event_type?.trim()) {
      setSaveReviewError('This session is missing card URL or event type. Run a new generation.')
      return
    }
    const unsavedPick = drafts.filter(
      (d) =>
        d.selected && d.state === 'pending' && (d.id == null || d.id <= 0),
    )
    if (unsavedPick.length === 0) {
      setSaveReviewError(
        'Select at least one preview that is not already saved as an internal draft in the studio.',
      )
      return
    }
    if (unsavedPick.length > 15) {
      setSaveReviewError('You can save at most 15 layouts for internal review at once.')
      return
    }
    setSaveReviewBusy(true)
    setSaveReviewError(null)
    try {
      const payloadDrafts = unsavedPick.map((d) => ({
        index: d.index,
        name: d.name,
        thumbnail: d.thumbnail,
        preview_alt: d.preview_alt,
        config: d.config,
        meta: d.meta,
      }))
      const res = await saveReviewDrafts({ card_url: card_url.trim(), event_type: event_type.trim(), drafts: payloadDrafts })
      flushSync(() => {
        const byIndex = new Map(res.saved.map((s) => [s.index, s]))
        setDrafts((rows) =>
          rows.map((r) => {
            const s = byIndex.get(r.index)
            if (!s) return r
            return {
              ...r,
              ...s,
              id: s.id ?? r.id,
              persisted: true,
              state: r.state,
              selected: r.selected,
            }
          }),
        )
        setResponse((prev) => (prev ? { ...prev, card_url: card_url.trim(), event_type: event_type.trim() } : prev))
      })
      const storageKey = `page-layouts-generate-${sessionId}`
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as GenerateLayoutResponse
          const byIdx = new Map(res.saved.map((s) => [s.index, s]))
          const mergedDrafts = parsed.drafts.map((d) => {
            const s = byIdx.get(d.index)
            if (!s) return { ...d, id: typeof d.id === 'number' && d.id > 0 ? d.id : null }
            return { ...d, ...s, id: s.id, persisted: true }
          })
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              ...parsed,
              card_url: card_url.trim(),
              event_type: event_type.trim(),
              drafts: mergedDrafts,
            }),
          )
        } catch (e) {
          logError('Failed to update sessionStorage after save-for-review', e)
        }
      }
      const q = encodeURIComponent(card_url.trim())
      router.push(`/host/page-layouts?card_url=${q}`)
    } catch (err: any) {
      logError('Save for review failed', err)
      setSaveReviewError(err?.response?.data?.error || err?.message || 'Failed to save for review.')
    } finally {
      setSaveReviewBusy(false)
    }
  }

  /**
   * One-click save + publish:
   * Preview-only items are saved to the studio first, then all selected items
   * are published in a single bulk call — no two-step flow required.
   */
  const onSaveAndPublish = async () => {
    if (selectedPendingDrafts.length === 0) return
    if (!response?.card_url?.trim() || !response?.event_type?.trim()) {
      alert('Missing card URL or event type — run a new generation.')
      return
    }
    setBulkBusy(true)
    try {
      const previewOnly = selectedPendingDrafts.filter((d) => d.id == null || (d.id as number) <= 0)
      const alreadySaved = selectedPendingDrafts.filter(
        (d) => typeof d.id === 'number' && (d.id as number) > 0,
      )
      let allIds: number[] = alreadySaved.map((d) => d.id as number)

      if (previewOnly.length > 0) {
        const res = await saveReviewDrafts({
          card_url: response.card_url.trim(),
          event_type: response.event_type.trim(),
          drafts: previewOnly.map((d) => ({
            index: d.index,
            name: d.name,
            thumbnail: d.thumbnail,
            preview_alt: d.preview_alt,
            config: d.config,
            meta: d.meta,
          })),
        })
        const byIndex = new Map(res.saved.map((s) => [s.index, s]))
        setDrafts((rows) =>
          rows.map((r) => {
            const s = byIndex.get(r.index)
            if (!s) return r
            return { ...r, ...s, id: s.id ?? r.id, persisted: true }
          }),
        )
        const newIds = res.saved
          .map((s) => s.id)
          .filter((id): id is number => typeof id === 'number' && id > 0)
        allIds = [...allIds, ...newIds]
      }

      if (allIds.length === 0) {
        alert('Nothing to publish — layouts could not be saved to the studio.')
        return
      }

      const result = await bulkPublishPageLayouts(allIds, 'public')
      const published = new Set(result.ids)
      setDrafts((rows) =>
        rows.map((r) =>
          typeof r.id === 'number' && published.has(r.id) ? { ...r, state: 'published' } : r,
        ),
      )
    } catch (err: any) {
      logError('Save and publish failed', err)
      alert(err?.response?.data?.error || 'Failed to publish. Please try again.')
    } finally {
      setBulkBusy(false)
    }
  }

  const openRemixDialog = () => {
    const pending = drafts.filter((d) => d.state === 'pending')
    const oneSelected = pending.filter((d) => d.selected)
    const anchor = oneSelected.length === 1 ? oneSelected[0] : pending[0] ?? null
    setRemixLockSource(anchor)
    setRemixLocks({ recipe: false, preset: true, tone: false })
    setRemixCount(8)
    setRemixError(null)
  }

  const closeRemixDialog = () => {
    if (remixBusy) return
    setRemixLockSource(null)
    setRemixError(null)
  }

  const submitRemix = async () => {
    if (!response) return
    const anchor =
      remixLockSource ||
      drafts.find((d) => d.state === 'pending') ||
      null
    setRemixBusy(true)
    setRemixError(null)
    try {
      const reqId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID().replace(/-/g, '')
          : `remix-${Date.now()}`
      const payload = {
        parent_request_id: response.request_id,
        request_id: reqId,
        n_outputs: remixCount,
        seed: Math.floor(Math.random() * 2_000_000_000),
        lock_recipe_id:
          remixLocks.recipe && anchor ? anchor.meta.recipe_id : null,
        lock_preset_id:
          remixLocks.preset && anchor ? anchor.meta.preset_id : null,
        lock_copy_idx: null,
      }
      const remixResponse = await remixPageLayouts(payload)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          `page-layouts-generate-${remixResponse.session_id}`,
          JSON.stringify(remixResponse),
        )
      }
      router.push(`/host/templates/layouts/generate/results/${remixResponse.session_id}`)
    } catch (err: any) {
      logError('Remix failed', err)
      setRemixError(
        err?.response?.data?.error ||
          err?.message ||
          'Remix failed. The parent generation may have expired.',
      )
    } finally {
      setRemixBusy(false)
    }
  }

  if (!authChecked || !allowed) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Checking permissions{LOADING_TAIL}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-eco-beige">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card className="border-red-200">
            <CardContent className="py-6">
              <p className="text-sm text-red-700">{error}</p>
              <div className="mt-4 flex gap-2">
                <Link href="/host/templates/layouts/generate">
                  <Button>Generate again</Button>
                </Link>
                <Link href="/host/page-layouts">
                  <Button variant="outline">Open Page Layout Studio</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading results{LOADING_TAIL}</p>
      </div>
    )
  }

  const summary = response.card_analysis_summary
  const sid = sessionId || ''
  const pendingCount = drafts.filter((d) => d.state === 'pending').length
  const publishedCount = drafts.filter((d) => d.state === 'published').length
  const previewOnlyPending = drafts.filter(
    (d) => d.state === 'pending' && (d.id == null || d.id <= 0),
  ).length
  const studioDraftPending = drafts.filter(
    (d) =>
      d.state === 'pending' && typeof d.id === 'number' && d.id > 0,
  ).length

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">Generated layouts</h1>
            <p className="text-gray-600 mt-1 text-sm">
              {drafts.length} options {MIDDOT} Pending: {pendingCount} {MIDDOT} Published:{' '}
              {publishedCount}
              {previewOnlyPending > 0 && (
                <>
                  {' '}
                  {MIDDOT}{' '}
                  <span className="text-gray-500">{previewOnlyPending} preview-only</span>
                </>
              )}
              {studioDraftPending > 0 && (
                <>
                  {' '}
                  {MIDDOT}{' '}
                  <span className="text-eco-green">{studioDraftPending} in studio</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
            <Link href={studioListHref}>
              <Button variant="outline">Page Layout Studio</Button>
            </Link>
            <Link href="/host/templates/layouts/generate">
              <Button variant="outline">New generation</Button>
            </Link>
            <Button
              type="button"
              onClick={openRemixDialog}
              disabled={
                remixBusy ||
                !response?.request_id ||
                !drafts.some((d) => d.state === 'pending')
              }
              variant="outline"
              className="gap-1 border-eco-green text-eco-green hover:bg-eco-green-light"
              title="Sample a new batch from the cached card analysis (same upload). Optional locks use one reference card below."
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
              Remix generation
            </Button>
            <Button
              onClick={onSaveReview}
              disabled={
                saveReviewBusy ||
                drafts.every((d) => !(d.selected && (d.id == null || d.id <= 0)))
              }
              variant="outline"
              className="border-eco-green text-eco-green hover:bg-eco-green-light"
            >
              {saveReviewBusy ? `Saving${LOADING_TAIL}` : 'Save selected for review'}
            </Button>
            <Button
              onClick={onSaveAndPublish}
              disabled={bulkBusy || selectedPendingDrafts.length === 0}
              className="bg-eco-green hover:bg-eco-green-dark text-white"
              title={
                selectedPendingDrafts.length === 0
                  ? 'Select at least one layout to publish'
                  : selectedPendingDrafts.some((d) => d.id == null || (d.id as number) <= 0)
                  ? 'Preview-only items will be saved to the studio then published automatically'
                  : undefined
              }
            >
              {bulkBusy ? `Publishing${LOADING_TAIL}` : `Publish ${selectedPendingDrafts.length} selected`}
            </Button>
          </div>
        </div>

        <Card className="mb-6 border-eco-green/25 bg-eco-green-light/20">
          <CardContent className="py-3 text-sm text-gray-700 leading-relaxed">
            <strong className="text-eco-green">Preview-only by default.</strong> AI outputs are not
            added to Page Layout Studio until you save a shortlist for internal review (up to 15).
            Someone can finalize and publish there. Selecting a draft does not persist it—you must
            use &ldquo;Save selected for review&rdquo; first (you&apos;ll jump to Page Layout Studio
            filtered to this greeting card after save). <strong>Publish</strong> stays disabled on preview rows until they exist in
            the studio (real <code className="text-xs">id</code>). <strong>Edit / full preview</strong>{' '}
            use the same studio routes and also need that save. <strong>Remix generation</strong>{' '}
            (top) resamples the whole batch from the cached card analysis, not a single grid card.
            {saveReviewError && (
              <p className="mt-2 text-xs text-red-700">{saveReviewError}</p>
            )}
          </CardContent>
        </Card>

        {summary && (
          <Card className="mb-6">
            <CardContent className="py-4 flex flex-wrap items-center gap-3 text-xs text-gray-700">
              <Badge variant="default">{summary.composition || 'unknown'} composition</Badge>
              <Badge variant="default">{summary.visual_style || 'mixed'} style</Badge>
              <Badge variant="default">{summary.dominant_feeling || 'neutral'} feeling</Badge>
              <Badge variant={summary.has_baked_text ? 'warning' : 'success'}>
                {summary.has_baked_text ? 'Baked-text card (overlays disabled)' : `${summary.quiet_region_count} quiet regions`}
              </Badge>
              {response.spend_snapshot && (
                <span className="ml-auto text-gray-500">
                  {`Today: $${response.spend_snapshot.daily_usd.toFixed(4)} ${MIDDOT} MTD: $${response.spend_snapshot.monthly_usd.toFixed(4)}`}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {drafts.map((draft, draftListIndex) => {
            const rk = draftRowKey(draft, sid)
            const hasStudioDraft = typeof draft.id === 'number' && draft.id > 0
            const rowKeyStable = `${sid || 'sess'}-${draft.index ?? draftListIndex}-${draftListIndex}`
            const displayHeadline =
              (draft.name || '').trim() ||
              [draft.meta.preset_id, draft.meta.recipe_id].filter(Boolean).join(` ${MIDDOT} `)
            const titleTooltip =
              draft.name?.trim()
                ? `${draft.name}${draft.meta.preset_id ? ` — ${draft.meta.preset_id}` : ''}`
                : displayHeadline
            return (
              <Card key={rowKeyStable} className={`overflow-hidden ${draft.state === 'rejected' ? 'opacity-50' : ''}`}>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium line-clamp-2 leading-snug min-h-[2.25rem]" title={titleTooltip}>
                    #{draft.index} {MIDDOT}{' '}
                    <span className="break-words">{displayHeadline}</span>
                  </CardTitle>
                  {draft.state === 'pending' && (
                    <input
                      type="checkbox"
                      checked={Boolean(draft.selected)}
                      onChange={(e) => {
                        const targetIndex = draft.index
                        setDrafts((rows) =>
                          rows.map((r) =>
                            r.index === targetIndex ? { ...r, selected: e.target.checked } : r,
                          ),
                        )
                      }}
                      aria-label={`Select preview #${draft.index}`}
                      className="mt-1"
                    />
                  )}
                </div>
                {draft.state === 'pending' && !hasStudioDraft && (
                  <Badge variant="default" className="mt-1 text-[10px] font-normal">
                    Preview only
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <div className="rounded border bg-white">
                  <PageLayoutCardPreview config={draft.config} />
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <Badge variant="default">{draft.meta.recipe_id}</Badge>
                  {draft.meta.tone && <Badge variant="default">{draft.meta.tone}</Badge>}
                  {draft.meta.fallback && <Badge variant="warning">fallback</Badge>}
                  {draft.meta.warnings?.length > 0 && (
                    <Badge variant="warning" title={draft.meta.warnings.join('\n')}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {draft.meta.warnings.length}
                    </Badge>
                  )}
                </div>
                {draft.meta.copy_notes && (
                  <p className="text-[11px] text-gray-500 line-clamp-2" title={draft.meta.copy_notes}>
                    {draft.meta.copy_notes}
                  </p>
                )}

                {draft.state === 'published' && (
                  <div className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle2 className="w-3 h-3" /> Published
                  </div>
                )}
                {draft.state === 'rejected' && (
                  <div className="text-xs text-gray-500">Rejected</div>
                )}
                {draft.state === 'pending' && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPublishOne(draft)}
                      disabled={!hasStudioDraft || busyKeys.has(rk)}
                      className="text-xs"
                      title={
                        !hasStudioDraft
                          ? 'Only available after this row is saved as an internal studio draft (needs a real layout id). Use Save selected for review first.'
                          : undefined
                      }
                    >
                      Publish
                    </Button>
                    {hasStudioDraft ? (
                      <>
                        <Link href={`/host/page-layouts/${draft.id}/edit`} target="_blank">
                          <Button size="sm" variant="outline" className="text-xs">
                            <ExternalLink className="w-3 h-3 mr-1" /> Edit
                          </Button>
                        </Link>
                        <Link href={`/host/page-layouts/${draft.id}/preview`} target="_blank">
                          <Button size="sm" variant="outline" className="text-xs">
                            <Eye className="w-3 h-3 mr-1" />
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-500 self-center px-1">Edit/preview after save</span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejectOrRemove(draft)}
                      disabled={busyKeys.has(rk)}
                      className="text-xs text-red-600 hover:text-red-700"
                      title={hasStudioDraft ? 'Remove from studio' : 'Dismiss preview'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {remixLockSource && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remix-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeRemixDialog}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remix-dialog-title" className="text-lg font-semibold text-gray-900 mb-1">
              Remix generation
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Draws a fresh set of layouts using the <strong>same greeting card</strong> and cached
              vision + copy (no new vision/copy charges). If you lock preset or recipe below, values
              come from reference <strong>#{remixLockSource.index}</strong>
              {drafts.filter((d) => d.selected && d.state === 'pending').length === 1
                ? ' (your single selected row).'
                : ' (first pending row; select exactly one checkbox to use a different reference).'}
              {' '}
              Cached data expires after ~1 hour.
            </p>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={remixLocks.preset}
                  onChange={(e) =>
                    setRemixLocks((p) => ({ ...p, preset: e.target.checked }))
                  }
                  className="mt-0.5"
                />
                <span>
                  Lock style preset
                  <span className="ml-1 text-xs text-gray-500">
                    ({remixLockSource.meta.preset_id})
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={remixLocks.recipe}
                  onChange={(e) =>
                    setRemixLocks((p) => ({ ...p, recipe: e.target.checked }))
                  }
                  className="mt-0.5"
                />
                <span>
                  Lock tile recipe
                  <span className="ml-1 text-xs text-gray-500">
                    ({remixLockSource.meta.recipe_id})
                  </span>
                </span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-20">Variations</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={remixCount}
                  onChange={(e) =>
                    setRemixCount(Math.max(1, Math.min(15, parseInt(e.target.value || '1', 10))))
                  }
                  className="w-20 border rounded px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-500">1-15</span>
              </div>
              {remixError && (
                <p className="text-xs text-red-600">{remixError}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={closeRemixDialog} disabled={remixBusy}>
                Cancel
              </Button>
              <Button
                onClick={submitRemix}
                disabled={remixBusy}
                className="bg-eco-green hover:bg-eco-green-dark text-white gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {remixBusy ? `Remixing${LOADING_TAIL}` : 'Remix'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
