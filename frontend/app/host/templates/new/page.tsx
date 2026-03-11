'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import TemplateStudioDesignCanvas from '@/components/invite/TemplateStudioDesignCanvas'
import { InviteConfig, Tile } from '@/lib/invite/schema'
import { createInviteDesignTemplate } from '@/lib/invite/api'
import { getErrorMessage, logError } from '@/lib/error-handler'

const DUMMY_EVENT = {
  title: 'Sample Event',
  date: '2025-06-15',
  city: 'Venue Name',
  slug: 'sample',
  has_rsvp: true,
  has_registry: true,
}

const DEFAULT_TILES: Tile[] = [
  { id: 'tile-title-0', type: 'title', enabled: true, order: 0, settings: { text: 'Sample Event' } },
  { id: 'tile-image-1', type: 'image', enabled: false, order: 1, settings: { src: '', fitMode: 'fit-to-screen' } },
  { id: 'tile-event-details-2', type: 'event-details', enabled: true, order: 2, settings: { location: 'Venue Name', date: '2025-06-15' } },
  { id: 'tile-description-3', type: 'description', enabled: false, order: 3, settings: { content: '' } },
  { id: 'tile-timer-4', type: 'timer', enabled: false, order: 4, settings: { enabled: true, format: 'circle', circleColor: '#0D6EFD', textColor: '#000000' } },
  { id: 'tile-feature-buttons-5', type: 'feature-buttons', enabled: true, order: 5, settings: { buttonColor: '#0D6EFD' } },
  { id: 'tile-event-carousel-7', type: 'event-carousel', enabled: false, order: 7, settings: { showFields: { image: true, title: true, dateTime: true, location: true, cta: true } } },
  { id: 'tile-footer-8', type: 'footer', enabled: false, order: 8, settings: { text: '' } },
]

const DEFAULT_CONFIG: InviteConfig = {
  themeId: 'classic-noir',
  customColors: {},
  tiles: DEFAULT_TILES,
  tileSetComplete: true,
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

export default function NewTemplatePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [config, setConfig] = useState<InviteConfig>(DEFAULT_CONFIG)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [previewAlt, setPreviewAlt] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) {
      router.push('/host/login')
      return
    }
    api
      .get<MeResponse>('/api/auth/me/')
      .then((res) => {
        if (!res.data?.is_staff) {
          router.push('/host/dashboard')
          return
        }
        setIsStaff(true)
      })
      .catch((e: any) => {
        if (e?.response?.status === 401) router.push('/host/login')
        else if (e?.response?.status === 403) router.push('/host/dashboard')
        else setIsStaff(false)
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Template name is required.', 'error')
      return
    }
    const toSave = buildConfigToSave(config)
    setSaving(true)
    try {
      const created = await createInviteDesignTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        thumbnail: thumbnail.trim() || undefined,
        preview_alt: previewAlt.trim() || undefined,
        config: toSave,
        visibility,
        status,
      })
      showToast('Template created.', 'success')
      router.push('/host/templates')
    } catch (e: any) {
      logError('Create template failed', e)
      showToast(getErrorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || isStaff === null) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">New Template</h1>
            <p className="text-gray-600 mt-1 text-sm">Create a new invite design template.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/host/templates">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving} className="bg-eco-green hover:bg-green-600 text-white">
              {saving ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-eco-green mb-3">Template metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Classic" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description for library" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Thumbnail URL</label>
              <Input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preview alt text</label>
              <Input value={previewAlt} onChange={(e) => setPreviewAlt(e.target.value)} placeholder="Accessibility text for thumbnail" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
              >
                <option value="internal">Internal</option>
                <option value="public">Public</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
        </div>

        <TemplateStudioDesignCanvas
          config={config}
          setConfig={setConfig}
          eventLike={DUMMY_EVENT}
          eventIdForTiles={0}
        />
      </div>
    </div>
  )
}
