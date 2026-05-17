'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Brain, Sparkles, Upload, Wand2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import GreetingCardMediaPicker from '@/components/invite/GreetingCardMediaPicker'
import { uploadGreetingCardImage } from '@/lib/invite/api'
import {
  generatePageLayouts,
  getLLMUsageSummary,
  type GenerateLayoutResponse,
  type LLMUsageSummary,
} from '@/lib/invite/auto-generator-api'
import { logError } from '@/lib/error-handler'

interface MeResponse {
  id: number
  email: string
  name: string
  is_staff?: boolean
  is_superuser?: boolean
  llm_module_access?: boolean
}

const EVENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'reception', label: 'Reception' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'baby_shower', label: 'Baby Shower' },
  { value: 'bridal_shower', label: 'Bridal Shower' },
  { value: 'naming_ceremony', label: 'Naming Ceremony' },
  { value: 'housewarming', label: 'Housewarming' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'religious_ceremony', label: 'Religious Ceremony' },
  { value: 'puja', label: 'Puja' },
  // Professional & business (matches Event.EVENT_TYPE_CHOICES)
  { value: 'corporate_event', label: 'Corporate Event' },
  { value: 'conference', label: 'Conference' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'networking', label: 'Networking Event' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'team_building', label: 'Team Building' },
  { value: 'award_ceremony', label: 'Award Ceremony' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'festival', label: 'Festival' },
  { value: 'cultural_event', label: 'Cultural Event' },
  { value: 'concert', label: 'Concert' },
  { value: 'dinner_party', label: 'Dinner Party' },
  { value: 'cocktail_party', label: 'Cocktail Party' },
  { value: 'other', label: 'Other' },
]

const MAX_CONCEPT_LENGTH = 500

/** Friendly rotating copy while vision + copy LLMs run and drafts are composed. */
const GENERATION_STATUS_LINES = [
  'Studying your greeting card up close…',
  'Noting colours, mood, and quiet spots for text…',
  'Writing invitation copy in a few tones…',
  'Pairing recipes with style presets…',
  'Composing your layout variants — almost there!',
]

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export default function GeneratePageLayoutPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [canUseLlm, setCanUseLlm] = useState(false)
  const [usage, setUsage] = useState<LLMUsageSummary | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cardUrl, setCardUrl] = useState('')
  const [cardThumb, setCardThumb] = useState('')
  const [cardSource, setCardSource] = useState<'library' | 'upload' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [eventType, setEventType] = useState('wedding')
  const [concept, setConcept] = useState('')
  const [nOutputs, setNOutputs] = useState(10)
  const [hasSubEvents, setHasSubEvents] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string>(() => newRequestId())
  const [generationLineIndex, setGenerationLineIndex] = useState(0)

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
        setCanUseLlm(true)
        try {
          const summary = await getLLMUsageSummary(7)
          if (!cancelled) setUsage(summary)
        } catch (err: any) {
          if (!cancelled) setUsageError(err?.response?.data?.error || 'Could not load usage summary.')
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
  }, [router])

  useEffect(() => {
    if (!submitting) return
    setGenerationLineIndex(0)
    const t = window.setInterval(() => {
      setGenerationLineIndex((i) => (i + 1) % GENERATION_STATUS_LINES.length)
    }, 2800)
    return () => window.clearInterval(t)
  }, [submitting])

  const dailyPct = usage?.daily?.pct ?? 0
  const monthlyPct = usage?.monthly?.pct ?? 0
  const killSwitchOff = !!usage && !usage.kill_switch_enabled
  const apiKeyMissing = !!usage && !usage.api_key_configured
  const dailyCapHit = (usage?.daily?.spend_usd ?? 0) >= (usage?.daily?.cap_usd ?? Infinity)
  const monthlyCapHit = (usage?.monthly?.spend_usd ?? 0) >= (usage?.monthly?.cap_usd ?? Infinity)
  const userDailyHit = !!usage && usage.user?.daily_count !== undefined && usage.user?.daily_quota !== undefined
    && usage.user.daily_count >= usage.user.daily_quota

  const blockReason = useMemo(() => {
    if (killSwitchOff) return 'LLM generation is currently disabled (toggle Generation enabled in Django Admin → LLM Platform Settings, or set LLM_GENERATION_ENABLED in env).'
    if (apiKeyMissing) return 'ANTHROPIC_API_KEY is not configured on the server.'
    if (dailyCapHit) return 'Daily cost cap reached. Try again tomorrow.'
    if (monthlyCapHit) return 'Monthly cost cap reached. Try again next month.'
    if (userDailyHit) return 'You\u2019ve reached your daily generation limit.'
    if (!cardUrl) return 'Pick a greeting card first.'
    if (!eventType) return 'Pick an event type.'
    return null
  }, [killSwitchOff, apiKeyMissing, dailyCapHit, monthlyCapHit, userDailyHit, cardUrl, eventType])

  const handleUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Max file size is 20 MB.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadGreetingCardImage(file)
      setCardUrl(url)
      setCardThumb(url)
      setCardSource('upload')
    } catch (err) {
      logError('Greeting card upload (auto-generator) failed', err)
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (blockReason) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result: GenerateLayoutResponse = await generatePageLayouts({
        card_url: cardUrl,
        event_type: eventType,
        concept: concept.trim(),
        n_outputs: nOutputs,
        has_sub_events: hasSubEvents,
        request_id: requestId,
      })
      try {
        sessionStorage.setItem(
          `page-layouts-generate-${result.session_id}`,
          JSON.stringify(result),
        )
      } catch {
        // sessionStorage full / disabled — non-fatal; results page can refetch by IDs.
      }
      router.push(`/host/templates/layouts/generate/results/${result.session_id}`)
    } catch (err: any) {
      logError('Page layout generate failed', err)
      const data = err?.response?.data
      setSubmitError(data?.error || data?.detail || 'Generation failed. Please try again.')
      setRequestId(newRequestId())
    } finally {
      setSubmitting(false)
    }
  }

  if (!authChecked || !canUseLlm) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Checking permissions\u2026</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-eco-green flex items-center gap-2">
              <Sparkles className="w-6 h-6" /> Page Layout Auto-Generator
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Pick a greeting card and an event type. We\u2019ll produce {nOutputs} distinct
              starter layouts for you to review and publish.
            </p>
          </div>
          <Link href="/host/templates/layouts/llm-usage">
            <Button variant="outline">View cost dashboard</Button>
          </Link>
        </div>

        {/* Cost indicator */}
        <Card className="mb-6">
          <CardContent className="py-4">
            {usageError ? (
              <p className="text-sm text-red-600">{usageError}</p>
            ) : usage ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={usage.kill_switch_enabled ? 'success' : 'warning'}>
                    {usage.kill_switch_enabled ? 'Generation ON' : 'Generation OFF'}
                  </Badge>
                  <span className="text-gray-700">
                    Today: <strong>${usage.daily.spend_usd.toFixed(4)}</strong> of ${usage.daily.cap_usd.toFixed(2)} ({dailyPct}%)
                  </span>
                  <span className="text-gray-700">
                    This month: <strong>${usage.monthly.spend_usd.toFixed(4)}</strong> of ${usage.monthly.cap_usd.toFixed(2)} ({monthlyPct}%)
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  Your daily quota: {usage.user.daily_count ?? 0} / {usage.user.daily_quota ?? 0}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading usage\u2026</p>
            )}
          </CardContent>
        </Card>

        {(killSwitchOff || apiKeyMissing) && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
                {killSwitchOff && (
                  <p>
                    <strong>Generation disabled.</strong> In <strong>Django Admin → LLM Platform Settings</strong>, enable{' '}
                    <strong>Generation enabled</strong> and save (no redeploy needed). If there is no admin row yet, set{' '}
                    <code>LLM_GENERATION_ENABLED=True</code> in the backend environment and restart workers.
                  </p>
                )}
                {apiKeyMissing && (
                  <p className="mt-1">
                    <strong>API key missing in the running container.</strong> The parameter must be attached to the{' '}
                    <strong>ECS task definition</strong> as env <code>ANTHROPIC_API_KEY</code> (SSM/Secrets{' '}
                    <code>valueFrom</code>), then redeploy so tasks pick it up. A parameter in SSM alone does not inject the key.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>New generation</CardTitle>
            <CardDescription>
              All inputs are required. Concept is treated as descriptive text only \u2014 it
              cannot inject instructions into the LLM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Card picker */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Greeting card</label>
              <div className="flex items-start gap-4">
                {cardThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cardThumb}
                    alt="Selected greeting card"
                    className="w-24 rounded border object-cover"
                    style={{ aspectRatio: '9 / 16' }}
                  />
                ) : (
                  <div className="w-24 rounded border bg-gray-100 flex items-center justify-center text-gray-400 text-xs" style={{ aspectRatio: '9 / 16' }}>
                    No card
                  </div>
                )}
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPickerOpen(true)}
                      disabled={uploading}
                    >
                      {cardSource === 'library' ? 'Change card from library' : 'Pick from library'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="gap-2"
                    >
                      <Upload size={16} />
                      {uploading
                        ? 'Uploading…'
                        : cardSource === 'upload'
                        ? 'Replace upload'
                        : 'Upload new'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUpload(file)
                      }}
                    />
                  </div>
                  {cardSource === 'upload' && (
                    <p className="text-xs text-gray-500">
                      Uploaded for this generation. It will be auto-saved to the greeting card
                      library when you publish a layout that uses it.
                    </p>
                  )}
                  {uploadError && (
                    <p className="text-xs text-red-600">{uploadError}</p>
                  )}
                  {cardUrl && (
                    <p className="text-xs text-gray-500 break-all max-w-xs">{cardUrl}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Event type */}
            <div>
              <label htmlFor="event_type" className="block text-sm font-medium text-gray-800 mb-2">
                Event type
              </label>
              <select
                id="event_type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Concept */}
            <div>
              <label htmlFor="concept" className="block text-sm font-medium text-gray-800 mb-2">
                Concept (optional)
              </label>
              <textarea
                id="concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value.slice(0, MAX_CONCEPT_LENGTH))}
                rows={3}
                placeholder="e.g. Outdoor sunset wedding under string lights, with a vintage feel."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {concept.length} / {MAX_CONCEPT_LENGTH}
              </p>
            </div>

            {/* n_outputs slider */}
            <div>
              <label htmlFor="n_outputs" className="block text-sm font-medium text-gray-800 mb-2">
                Number of variants: <strong>{nOutputs}</strong>
              </label>
              <input
                id="n_outputs"
                type="range"
                min={5}
                max={15}
                step={1}
                value={nOutputs}
                onChange={(e) => setNOutputs(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>5</span>
                <span>10</span>
                <span>15</span>
              </div>
            </div>

            {/* Has sub-events */}
            <div className="flex items-center gap-2">
              <input
                id="has_sub_events"
                type="checkbox"
                checked={hasSubEvents}
                onChange={(e) => setHasSubEvents(e.target.checked)}
              />
              <label htmlFor="has_sub_events" className="text-sm text-gray-800">
                This event will have sub-events (allow multi-event recipes)
              </label>
            </div>

            {/* Submit */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {submitError}
              </div>
            )}

            {blockReason && !submitting && (
              <p className="text-sm text-amber-700">{blockReason}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/host/dashboard">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !!blockReason}
                className="bg-eco-green hover:bg-green-600 text-white"
              >
                {submitting ? `Generating ${nOutputs} layouts\u2026` : `Generate ${nOutputs} layouts`}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              This call uses Anthropic Claude. Cold-cache cost ~ $0.023; warm-cache ~ $0.009.
            </p>
          </CardContent>
        </Card>
      </div>

      <GreetingCardMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(src) => {
          setCardUrl(src)
          setCardThumb(src)
          setCardSource('library')
          setPickerOpen(false)
        }}
      />

      {submitting && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="llm-generating-title"
          aria-describedby="llm-generating-desc"
          aria-busy="true"
        >
          <div className="relative max-w-sm w-full rounded-2xl border-2 border-eco-green/30 bg-gradient-to-b from-amber-50 to-eco-beige shadow-xl overflow-hidden">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-eco-green/10" aria-hidden />
            <div className="absolute -left-4 bottom-8 h-16 w-16 rounded-full bg-amber-200/40" aria-hidden />
            <div className="relative p-6 text-center">
              <div className="flex justify-center gap-2 mb-4">
                <div className="rounded-full bg-eco-green p-2.5 text-white shadow-md animate-pulse">
                  <Brain className="w-6 h-6" strokeWidth={1.75} aria-hidden />
                </div>
                <div
                  className="rounded-full bg-amber-400/90 p-2.5 text-amber-950 shadow-md animate-bounce"
                  style={{ animationDuration: '1.8s' }}
                >
                  <Wand2 className="w-6 h-6" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="rounded-full bg-eco-green/80 p-2.5 text-white shadow-md animate-pulse [animation-delay:200ms]">
                  <Sparkles className="w-6 h-6" strokeWidth={1.75} aria-hidden />
                </div>
              </div>
              <h2 id="llm-generating-title" className="text-lg font-semibold text-eco-green">
                Our AI is cooking up your templates
              </h2>
              <p
                id="llm-generating-desc"
                className="mt-2 text-sm text-gray-700 min-h-[3rem] transition-opacity duration-300"
              >
                {GENERATION_STATUS_LINES[generationLineIndex]}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                Sit tight — vision and copy can take 20–60 seconds. Do not close this tab.
              </p>
              <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-2 w-2 rounded-full bg-eco-green/70 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
