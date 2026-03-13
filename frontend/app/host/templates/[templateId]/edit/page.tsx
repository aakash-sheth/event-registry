'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import TemplateStudioDesignCanvas from '@/components/invite/TemplateStudioDesignCanvas'
import { InviteConfig } from '@/lib/invite/schema'
import { getInviteDesignTemplate, updateInviteDesignTemplate } from '@/lib/invite/api'
import { getErrorMessage, logError } from '@/lib/error-handler'

const DUMMY_EVENT = {
  title: 'Sample Event',
  date: '2025-06-15',
  city: 'Venue Name',
  slug: 'sample',
  has_rsvp: true,
  has_registry: true,
}

function buildConfigToSave(config: InviteConfig): InviteConfig {
  const sorted = [...(config.tiles || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const tilesWithOrder = sorted.map((t, i) => ({ ...t, order: i }))
  return { ...config, tiles: tilesWithOrder }
}

interface MeResponse {
  id: number
  email: string
  name: string
  is_staff?: boolean
}

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const templateId = params.templateId ? parseInt(params.templateId as string) : null
  const { showToast } = useToast()
  const [config, setConfig] = useState<InviteConfig | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [previewAlt, setPreviewAlt] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')

  // Tracks whether the user has made any edits since the page loaded.
  // Prevents autosave from firing on the initial state population from the API.
  const hasUserEditedRef = useRef(false)
  // Mutex: prevents autosave and manual save from running concurrently.
  const isSavingRef = useRef(false)
  const previewWindowRef = useRef<Window | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)

  // Keep a persistent BroadcastChannel open for the lifetime of this page so
  // postMessage() is never called on a channel that was immediately closed.
  useEffect(() => {
    if (!templateId || isNaN(templateId)) return
    const ch = new BroadcastChannel(`template-preview-${templateId}`)
    broadcastChannelRef.current = ch
    return () => {
      ch.close()
      broadcastChannelRef.current = null
    }
  }, [templateId])

  useEffect(() => {
    if (!templateId || isNaN(templateId)) {
      setLoading(false)
      return
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) {
      router.push('/host/login')
      return
    }
    Promise.all([
      api.get<MeResponse>('/api/auth/me/'),
      getInviteDesignTemplate(templateId),
    ])
      .then(([meRes, template]) => {
        if (!meRes.data?.is_staff) {
          router.push('/host/dashboard')
          return
        }
        setIsStaff(true)
        setName(template.name)
        setDescription(template.description ?? '')
        setThumbnail(template.thumbnail ?? '')
        setPreviewAlt(template.preview_alt ?? '')
        setVisibility(template.visibility ?? 'public')
        setStatus(template.status ?? 'draft')
        setConfig(template.config && typeof template.config === 'object' ? (template.config as InviteConfig) : null)
      })
      .catch((e: any) => {
        if (e?.response?.status === 401) router.push('/host/login')
        else if (e?.response?.status === 403 || e?.response?.status === 404) router.push('/host/templates')
        else {
          logError('Load template failed', e)
          showToast(getErrorMessage(e), 'error')
        }
      })
      .finally(() => setLoading(false))
  }, [templateId, router])

  // Broadcast config changes to the full-screen preview tab (debounced 500ms).
  // Uses the persistent channel so the message is never dropped by a premature close().
  useEffect(() => {
    if (!templateId || !config) return
    const timer = setTimeout(() => {
      broadcastChannelRef.current?.postMessage({ type: 'TEMPLATE_CONFIG_UPDATE', config })
    }, 500)
    return () => clearTimeout(timer)
  }, [config, templateId])

  // Autosave: fires 2s after the last user-initiated change.
  // Skipped on initial load (hasUserEditedRef stays false until user edits).
  // isSavingRef prevents concurrent execution with the manual Save button.
  useEffect(() => {
    if (!hasUserEditedRef.current || !templateId || !config || !name.trim()) return
    const timer = setTimeout(async () => {
      if (isSavingRef.current) return
      isSavingRef.current = true
      setAutoSaveStatus('saving')
      try {
        await updateInviteDesignTemplate(templateId, {
          name: name.trim(),
          description: description.trim() || undefined,
          thumbnail: thumbnail.trim() || undefined,
          preview_alt: previewAlt.trim() || undefined,
          config: buildConfigToSave(config),
          visibility,
          status,
        })
        setAutoSaveStatus('saved')
      } catch (e: any) {
        logError('Autosave failed', e)
        setAutoSaveStatus('error')
      } finally {
        isSavingRef.current = false
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [config, name, description, thumbnail, previewAlt, visibility, status, templateId])

  // Auto-dismiss the "Saved ✓" indicator after 3s
  useEffect(() => {
    if (autoSaveStatus !== 'saved') return
    const timer = setTimeout(() => setAutoSaveStatus('idle'), 3000)
    return () => clearTimeout(timer)
  }, [autoSaveStatus])

  // Wrapper passed to TemplateStudioDesignCanvas so tile edits mark the page dirty.
  const handleConfigChange = useCallback((action: React.SetStateAction<InviteConfig>) => {
    hasUserEditedRef.current = true
    setConfig((prev) => {
      if (prev === null) return prev
      return typeof action === 'function' ? action(prev) : action
    })
  }, [])

  // Shared save logic used by both the manual Save button and the "← Templates" nav guard.
  const performSave = async () => {
    if (!templateId || !config || isSavingRef.current) return
    if (!name.trim()) {
      showToast('Template name is required.', 'error')
      return
    }
    isSavingRef.current = true
    setSaving(true)
    setAutoSaveStatus('saving')
    try {
      await updateInviteDesignTemplate(templateId, {
        name: name.trim(),
        description: description.trim() || undefined,
        thumbnail: thumbnail.trim() || undefined,
        preview_alt: previewAlt.trim() || undefined,
        config: buildConfigToSave(config),
        visibility,
        status,
      })
      setAutoSaveStatus('saved')
      hasUserEditedRef.current = false
    } catch (e: any) {
      logError('Update template failed', e)
      showToast(getErrorMessage(e), 'error')
      setAutoSaveStatus('error')
    } finally {
      isSavingRef.current = false
      setSaving(false)
    }
  }

  // Explicit save button handler.
  const handleSave = () => performSave()

  // Navigation guard: flush any pending changes before leaving.
  const handleNavigateBack = async () => {
    if (hasUserEditedRef.current) await performSave()
    router.push('/host/templates')
  }

  if (loading || isStaff === null) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  if (!templateId || isNaN(templateId) || config === null) {
    return (
      <div className="min-h-screen bg-eco-beige flex flex-col items-center justify-center gap-2">
        <p className="text-gray-600">Template not found.</p>
        <Link href="/host/templates">
          <Button variant="outline">Back to templates</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">Edit Template</h1>
            <p className="text-gray-600 mt-1 text-sm">Update template metadata and design.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Autosave status indicator */}
            <span className="text-xs min-w-[90px] text-right">
              {autoSaveStatus === 'saving' && <span className="text-gray-400">Autosaving…</span>}
              {autoSaveStatus === 'saved' && <span className="text-eco-green">Saved ✓</span>}
              {autoSaveStatus === 'error' && (
                <button
                  onClick={handleSave}
                  className="text-red-500 underline hover:text-red-700"
                >
                  Save failed — retry
                </button>
              )}
            </span>

            <Button variant="outline" onClick={handleNavigateBack}>
              ← Templates
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const url = `/host/templates/${templateId}/preview`
                if (config) {
                  localStorage.setItem(`template-preview-config-${templateId}`, JSON.stringify(config))
                }
                if (previewWindowRef.current && !previewWindowRef.current.closed) {
                  previewWindowRef.current.focus()
                  broadcastChannelRef.current?.postMessage({ type: 'TEMPLATE_CONFIG_UPDATE', config })
                } else {
                  const win = window.open(url, `template-preview-${templateId}`)
                  if (!win) {
                    showToast('Popup blocked — please allow popups for this site to use preview.', 'error')
                  } else {
                    previewWindowRef.current = win
                  }
                }
              }}
              disabled={!templateId}
            >
              Preview
            </Button>
            {/* Publish / Unpublish — the only explicit action needed alongside autosave */}
            <Button
              onClick={async () => {
                const newStatus = status === 'published' ? 'draft' : 'published'
                hasUserEditedRef.current = true
                setStatus(newStatus)
              }}
              disabled={autoSaveStatus === 'saving' || saving}
              className={status === 'published'
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                : 'bg-eco-green hover:bg-green-600 text-white'}
            >
              {status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-eco-green mb-3">Template metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                value={name}
                onChange={(e) => { hasUserEditedRef.current = true; setName(e.target.value) }}
                placeholder="e.g. Classic"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={description}
                onChange={(e) => { hasUserEditedRef.current = true; setDescription(e.target.value) }}
                placeholder="Short description for library"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Thumbnail URL</label>
              <Input
                value={thumbnail}
                onChange={(e) => { hasUserEditedRef.current = true; setThumbnail(e.target.value) }}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preview alt text</label>
              <Input
                value={previewAlt}
                onChange={(e) => { hasUserEditedRef.current = true; setPreviewAlt(e.target.value) }}
                placeholder="Accessibility text for thumbnail"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => { hasUserEditedRef.current = true; setVisibility(e.target.value) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
              >
                <option value="internal">Internal</option>
                <option value="public">Public</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </div>

        <TemplateStudioDesignCanvas
          config={config!}
          setConfig={handleConfigChange as React.Dispatch<React.SetStateAction<InviteConfig>>}
          eventLike={DUMMY_EVENT}
          eventIdForTiles={0}
        />
      </div>
    </div>
  )
}
