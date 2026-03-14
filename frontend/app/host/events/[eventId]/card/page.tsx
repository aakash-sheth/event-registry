'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api, { uploadImage } from '@/lib/api'
import { getInvitePage, updateInvitePage, getGreetingCardSamples, type GreetingCardSample } from '@/lib/invite/api'
import type { ImageTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import WizardProgress from '@/components/host/WizardProgress'
import { logError } from '@/lib/error-handler'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextBox {
  id: string
  text: string
  x: number         // % from left of canvas (0–100)
  y: number         // % from top of canvas (0–100)
  width: number     // % of canvas width (default 80)
  height: number | null  // % of canvas height, null = auto
  fontFamily: string
  fontSize: number  // px (default 32)
  color: string     // hex (default '#ffffff')
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

interface DragState {
  mode: 'move' | 'resize'
  resizeHandle: ResizeHandle | null
  boxId: string
  startPointerX: number
  startPointerY: number
  startBoxX: number
  startBoxY: number
  startBoxWidth: number
  startBoxHeight: number
  snapshot: TextBox[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADIENT_PRESETS: string[] = [
  'linear-gradient(135deg, #fce4ec 0%, #f48fb1 100%)',
  'linear-gradient(135deg, #e8f5e9 0%, #66bb6a 100%)',
  'linear-gradient(135deg, #ede7f6 0%, #9575cd 100%)',
  'linear-gradient(135deg, #fff8e1 0%, #ffb300 100%)',
  'linear-gradient(135deg, #e3f2fd 0%, #42a5f5 100%)',
  'linear-gradient(135deg, #fce4ec 0%, #e91e63 100%)',
  'linear-gradient(135deg, #f1f8e9 0%, #8bc34a 100%)',
  'linear-gradient(135deg, #eceff1 0%, #607d8b 100%)',
  'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
  'linear-gradient(135deg, #000000 0%, #434343 100%)',
  'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
  'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
  'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)',
]

const SUBTITLE_MAP: Record<string, string> = {
  wedding: "We're getting married!",
  birthday: 'Come celebrate with us!',
  baby_shower: 'A little one is on the way!',
  engagement: 'We said yes!',
  anniversary: 'Celebrating our love',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildInitialBoxes(title: string, eventType: string): TextBox[] {
  const subtitle = SUBTITLE_MAP[eventType] ?? 'Join us for a special celebration!'
  return [
    {
      id: makeId(),
      text: title || 'Your Names Here',
      x: 10,
      y: 30,
      width: 80,
      height: null,
      fontFamily: "'Playfair Display', serif",
      fontSize: 40,
      color: '#ffffff',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      textAlign: 'center',
      verticalAlign: 'middle',
    },
    {
      id: makeId(),
      text: subtitle,
      x: 10,
      y: 60,
      width: 80,
      height: null,
      fontFamily: 'Georgia, serif',
      fontSize: 20,
      color: '#f0f0f0',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      textAlign: 'center',
      verticalAlign: 'middle',
    },
  ]
}

// ---------------------------------------------------------------------------
// Sub-component: Background Library Modal
// ---------------------------------------------------------------------------

interface BgModalProps {
  onClose: () => void
  onSelectGradient: (gradient: string) => void
  onSelectSample: (sample: GreetingCardSample) => void
}

function BgModal({ onClose, onSelectGradient, onSelectSample }: BgModalProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'samples' | 'gradients' | 'gifs'>('samples')
  const [samples, setSamples] = useState<GreetingCardSample[]>([])
  const [loadingSamples, setLoadingSamples] = useState(false)

  // Fetch samples when tab is shown
  React.useEffect(() => {
    if (activeTab !== 'samples') return
    setLoadingSamples(true)
    getGreetingCardSamples()
      .then(setSamples)
      .finally(() => setLoadingSamples(false))
  }, [activeTab])

  const TABS = [
    { id: 'samples' as const, label: 'Samples' },
    { id: 'gradients' as const, label: 'Gradients' },
    { id: 'gifs' as const, label: 'GIFs' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">Choose Background</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'py-2.5 px-4 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'samples' && (
            loadingSamples ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-gray-400 text-sm">Loading samples…</p>
              </div>
            ) : samples.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-center">
                <p className="text-gray-500 text-sm leading-relaxed">
                  No samples available yet. Upload your own background using &quot;Upload Background&quot;.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => onSelectSample(sample)}
                    className="group flex flex-col rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-400 transition-all shadow-sm hover:shadow-md"
                    aria-label={`Select ${sample.name}`}
                  >
                    <div className="w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sample.background_image_url}
                        alt={sample.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <div className="px-2 py-2 bg-white text-left">
                      <p className="text-xs font-medium text-gray-800 truncate">{sample.name}</p>
                      {sample.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{sample.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {activeTab === 'gradients' && (
            <div className="grid grid-cols-4 gap-3">
              {GRADIENT_PRESETS.map((gradient, i) => (
                <button
                  key={i}
                  aria-label={`Gradient preset ${i + 1}`}
                  onClick={() => onSelectGradient(gradient)}
                  className="h-20 rounded-xl border-2 border-transparent hover:border-blue-400 transition-all hover:scale-105"
                  style={{ background: gradient }}
                />
              ))}
            </div>
          )}

          {activeTab === 'gifs' && (
            <div className="flex items-center justify-center h-40 text-center">
              <p className="text-gray-500 text-sm leading-relaxed">
                GIF library coming soon — upload your own GIF using &quot;Upload Background&quot;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GreetingCardPage(): React.ReactElement {
  const params = useParams()
  const router = useRouter()
  const eventId = Number(params.eventId)

  // Canvas + drag
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Undo / redo
  const undoStack = useRef<TextBox[][]>([])
  const redoStack = useRef<TextBox[][]>([])
  const textBoxesRef = useRef<TextBox[]>([])
  const editStartSnapshotRef = useRef<TextBox[] | null>(null)

  // Refs to each contentEditable div — keyed by box.id — for auto-focus
  const contentEditableRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // State
  const [event, setEvent] = useState<{ title: string; event_type: string } | null>(null)
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [bgGradient, setBgGradient] = useState<string>(GRADIENT_PRESETS[0]!)
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showBgModal, setShowBgModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userHasEditedText, setUserHasEditedText] = useState(false)
  const [pendingSample, setPendingSample] = useState<GreetingCardSample | null>(null)

  // Load event + restore saved state from localStorage
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    api
      .get<{ id: number; title: string; event_type: string }>(`/api/events/${eventId}/`)
      .then((res) => {
        const data = res.data
        setEvent(data)
        // Restore saved text boxes (card designer work) or fall back to event-based defaults
        const savedBoxes = localStorage.getItem(`card-textboxes-${eventId}`)
        if (savedBoxes) {
          try {
            setTextBoxes(JSON.parse(savedBoxes) as TextBox[])
            setUserHasEditedText(true)
          } catch {
            setTextBoxes(buildInitialBoxes(data.title, data.event_type))
          }
        } else {
          setTextBoxes(buildInitialBoxes(data.title, data.event_type))
        }
      })
      .catch((err: unknown) => {
        logError('GreetingCardPage: failed to load event', err)
      })
  }, [eventId])

  // Restore saved background from localStorage
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    const saved = localStorage.getItem(`card-bg-${eventId}`)
    if (saved) {
      setBgUrl(saved)
      setBgGradient(GRADIENT_PRESETS[0]!)
    } else {
      const savedGradient = localStorage.getItem(`card-gradient-${eventId}`)
      if (savedGradient) setBgGradient(savedGradient)
    }
  }, [eventId])

  // Persist text boxes to localStorage — debounced 500ms to avoid writing on every drag pixel
  useEffect(() => {
    if (!eventId || isNaN(eventId) || textBoxes.length === 0) return
    const timer = setTimeout(() => {
      localStorage.setItem(`card-textboxes-${eventId}`, JSON.stringify(textBoxes))
    }, 500)
    return () => clearTimeout(timer)
  }, [textBoxes, eventId])

  // Keep textBoxesRef in sync (used by undo/redo handlers in stable closures)
  useEffect(() => { textBoxesRef.current = textBoxes }, [textBoxes])

  // Auto-focus + populate the contentEditable div when editing starts
  useEffect(() => {
    if (!editingId) return
    const el = contentEditableRefs.current.get(editingId)
    if (!el) return
    const text = textBoxesRef.current.find((b) => b.id === editingId)?.text ?? ''
    el.innerText = text
    el.focus()
    // Move cursor to end
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }, [editingId])

  // Keyboard undo / redo (Ctrl/Cmd+Z and Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const prev = undoStack.current.pop()
        if (prev !== undefined) {
          redoStack.current.push([...textBoxesRef.current])
          setTextBoxes(prev)
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        const next = redoStack.current.pop()
        if (next !== undefined) {
          undoStack.current.push([...textBoxesRef.current])
          setTextBoxes(next)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // -------------------------------------------------------------------------
  // Text box helpers
  // -------------------------------------------------------------------------

  const selectedBox = textBoxes.find((b) => b.id === selectedId) ?? null

  const pushHistory = useCallback((snapshot: TextBox[]): void => {
    undoStack.current = [...undoStack.current, [...snapshot]].slice(-50)
    redoStack.current = []
  }, [])

  function updateBox<K extends keyof TextBox>(id: string, key: K, value: TextBox[K]): void {
    if (key === 'text') {
      setUserHasEditedText(true)
    } else {
      pushHistory(textBoxesRef.current)
    }
    setTextBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [key]: value } : b))
    )
  }

  function toggleProp(id: string, key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
    pushHistory(textBoxesRef.current)
    setTextBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [key]: !b[key] } : b))
    )
  }

  function deleteBox(id: string): void {
    pushHistory(textBoxesRef.current)
    setTextBoxes((prev) => prev.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (editingId === id) setEditingId(null)
  }

  function addTextBox(): void {
    pushHistory(textBoxesRef.current)
    const newBox: TextBox = {
      id: makeId(),
      text: 'Add text here',
      x: 10,
      y: 20,
      width: 80,
      height: null,
      fontFamily: "'Playfair Display', serif",
      fontSize: 32,
      color: '#ffffff',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      textAlign: 'center',
      verticalAlign: 'middle',
    }
    setTextBoxes((prev) => [...prev, newBox])
    setSelectedId(newBox.id)
  }

  // -------------------------------------------------------------------------
  // Drag handlers (pointer events on canvas container)
  // -------------------------------------------------------------------------

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const { mode, resizeHandle, boxId, startPointerX, startPointerY, startBoxX, startBoxY, startBoxWidth, startBoxHeight } = dragState.current
    const dx = ((e.clientX - startPointerX) / rect.width) * 100
    const dy = ((e.clientY - startPointerY) / rect.height) * 100
    if (mode === 'resize') {
      setTextBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== boxId) return b
          let newX = startBoxX, newY = startBoxY, newW = startBoxWidth, newH = startBoxHeight
          if (resizeHandle === 'se') {
            newW = clamp(startBoxWidth + dx, 10, 100 - startBoxX)
            newH = clamp(startBoxHeight + dy, 5, 100 - startBoxY)
          } else if (resizeHandle === 'sw') {
            const deltaW = -dx
            newW = clamp(startBoxWidth + deltaW, 10, startBoxX + startBoxWidth)
            newX = startBoxX + startBoxWidth - newW
            newH = clamp(startBoxHeight + dy, 5, 100 - startBoxY)
          } else if (resizeHandle === 'ne') {
            newW = clamp(startBoxWidth + dx, 10, 100 - startBoxX)
            const deltaH = -dy
            newH = clamp(startBoxHeight + deltaH, 5, startBoxY + startBoxHeight)
            newY = startBoxY + startBoxHeight - newH
          } else if (resizeHandle === 'nw') {
            const deltaW = -dx
            newW = clamp(startBoxWidth + deltaW, 10, startBoxX + startBoxWidth)
            newX = startBoxX + startBoxWidth - newW
            const deltaH = -dy
            newH = clamp(startBoxHeight + deltaH, 5, startBoxY + startBoxHeight)
            newY = startBoxY + startBoxHeight - newH
          }
          return { ...b, x: newX, y: newY, width: newW, height: newH }
        })
      )
    } else {
      setTextBoxes((prev) =>
        prev.map((b) => b.id !== boxId ? b : {
          ...b,
          x: clamp(startBoxX + dx, 0, 100 - b.width),
          y: clamp(startBoxY + dy, 0, 95),
        })
      )
    }
  }, [])

  const handleCanvasPointerUp = useCallback(() => {
    if (dragState.current) {
      pushHistory(dragState.current.snapshot)
      dragState.current = null
    }
  }, [pushHistory])

  // -------------------------------------------------------------------------
  // Upload handler
  // -------------------------------------------------------------------------

  async function handleUpload(file: File): Promise<void> {
    if (file.size > 10 * 1024 * 1024) {
      alert('Max file size is 10 MB.')
      return
    }
    setUploading(true)
    try {
      const url = await uploadImage(file, eventId)
      setBgUrl(url)
      setBgGradient(GRADIENT_PRESETS[0]!)
      localStorage.setItem(`card-bg-${eventId}`, url)
      localStorage.removeItem(`card-gradient-${eventId}`)
    } catch (err: unknown) {
      logError('GreetingCardPage: upload failed', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // -------------------------------------------------------------------------
  // Next step
  // -------------------------------------------------------------------------

  async function handleNext(): Promise<void> {
    const hasExplicitSelection = !!bgUrl || !!localStorage.getItem(`card-gradient-${eventId}`)
    if (hasExplicitSelection) {
      setSaving(true)
      try {
        const existing = await getInvitePage(eventId)
        if (existing) {
          const updatedTiles = (existing.config.tiles ?? []).map((t) =>
            t.type === 'image'
              ? {
                  ...t,
                  settings: {
                    ...(t.settings as ImageTileSettings),
                    src: bgUrl ?? undefined,
                    backgroundGradient: bgUrl ? undefined : bgGradient,
                    fitMode: 'full-image' as const,
                    textOverlays: textBoxes,
                  },
                }
              : t
          )
          await updateInvitePage(eventId, { config: { ...existing.config, tiles: updatedTiles } })
        }
      } catch {
        // Non-fatal: layout step reads from localStorage as fallback
      } finally {
        setSaving(false)
      }
    }
    router.push(`/host/events/${eventId}/layout`)
  }

  // -------------------------------------------------------------------------
  // Guard
  // -------------------------------------------------------------------------

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500 text-sm">Invalid event ID.</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Google Fonts */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Lora:ital,wght@0,400;0,600;1,400&family=Poppins:wght@400;600&family=Open+Sans:wght@400;600&family=Montserrat:wght@400;600&family=Raleway:wght@400;600&display=swap');` }} />

      <WizardProgress currentStep={2} eventId={eventId} />

      {/* ------------------------------------------------------------------ */}
      {/* Sticky header: background bar + always-visible text toolbar         */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-0 z-20">
        {/* Row 1: background controls */}
        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowBgModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Select Background
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload Background'}
          </button>

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

          {event && (
            <span className="text-xs text-gray-500 truncate max-w-[180px]">{event.title}</span>
          )}

          {bgUrl && (
            <span className="ml-auto text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded">
              Custom image active
            </span>
          )}
        </div>

        {/* Row 2: text format toolbar — always visible */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap overflow-x-auto">
          {/* Add Text — always active */}
          <button
            onClick={addTextBox}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-400 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium flex-none"
          >
            + Add Text
          </button>

          <div className="w-px h-5 bg-gray-200 flex-none" />

          {/* Format controls — dimmed when no box selected */}
          <div className={`flex items-center gap-2 flex-wrap transition-opacity ${selectedBox ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            {/* Font family */}
            <select
              value={selectedBox?.fontFamily ?? FONT_OPTIONS[0]!.family}
              onChange={(e) => selectedBox && updateBox(selectedBox.id, 'fontFamily', e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white max-w-[130px]"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.family}>
                  {f.name}
                </option>
              ))}
            </select>

            {/* Font size */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={8}
                max={200}
                value={selectedBox?.fontSize ?? 32}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && selectedBox) updateBox(selectedBox.id, 'fontSize', clamp(v, 8, 200))
                }}
                className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>

            <div className="w-px h-5 bg-gray-200 flex-none" />

            <button
              onClick={() => selectedBox && toggleProp(selectedBox.id, 'bold')}
              className={`px-2 py-1 rounded text-sm font-bold transition-colors ${selectedBox?.bold ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Bold"
            >B</button>

            <button
              onClick={() => selectedBox && toggleProp(selectedBox.id, 'italic')}
              className={`px-2 py-1 rounded text-sm italic transition-colors ${selectedBox?.italic ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Italic"
            >I</button>

            <button
              onClick={() => selectedBox && toggleProp(selectedBox.id, 'underline')}
              className={`px-2 py-1 rounded text-sm underline transition-colors ${selectedBox?.underline ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Underline"
            >U</button>

            <button
              onClick={() => selectedBox && toggleProp(selectedBox.id, 'strikethrough')}
              className={`px-2 py-1 rounded text-sm line-through transition-colors ${selectedBox?.strikethrough ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Strikethrough"
            >S</button>

            <div className="w-px h-5 bg-gray-200 flex-none" />

            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => selectedBox && updateBox(selectedBox.id, 'textAlign', align)}
                title={`Align ${align}`}
                className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox?.textAlign === align ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              >
                {align === 'left' ? '←' : align === 'center' ? '↔' : '→'}
              </button>
            ))}

            <div className="w-px h-5 bg-gray-200 flex-none" />

            {(['top', 'middle', 'bottom'] as const).map((va) => (
              <button
                key={va}
                onClick={() => selectedBox && updateBox(selectedBox.id, 'verticalAlign', va)}
                title={`Vertical ${va}`}
                className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox?.verticalAlign === va ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              >
                {va === 'top' ? '↑' : va === 'middle' ? '↕' : '↓'}
              </button>
            ))}

            <div className="w-px h-5 bg-gray-200 flex-none" />

            <div className="flex items-center gap-1">
              <input
                type="color"
                value={selectedBox?.color ?? '#ffffff'}
                onChange={(e) => selectedBox && updateBox(selectedBox.id, 'color', e.target.value)}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                title="Text color"
              />
              <input
                type="text"
                value={selectedBox?.color ?? '#ffffff'}
                maxLength={7}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v) && selectedBox) updateBox(selectedBox.id, 'color', v)
                }}
                className="w-24 text-xs border border-gray-300 rounded px-2 py-1 font-mono"
                placeholder="#ffffff"
              />
            </div>

            <div className="w-px h-5 bg-gray-200 flex-none" />

            <button
              onClick={() => selectedBox && deleteBox(selectedBox.id)}
              className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-sm transition-colors"
              title="Delete text box"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Canvas area                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex items-start justify-center px-4 py-6">
        {/* Outer wrapper enforces 9:16 aspect ratio at max-height 72vh */}
        <div
          style={{
            height: '72vh',
            aspectRatio: '9 / 16',
          }}
          className="relative select-none"
        >
          <div
            ref={canvasRef}
            className="relative overflow-hidden rounded-2xl shadow-2xl"
            style={{ width: '100%', height: '100%' }}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerUp}
            onClick={(e) => {
              // Deselect if clicking canvas background directly
              if (e.target === canvasRef.current || e.target === e.currentTarget) {
                setSelectedId(null)
                setEditingId(null)
              }
            }}
          >
            {/* Background layer */}
            {bgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bgUrl}
                alt="Card background"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: bgGradient }}
              />
            )}

            {/* Text boxes */}
            {textBoxes.map((box) => {
              const isSelected = selectedId === box.id
              const isEditing = editingId === box.id

              const justifyContent =
                box.verticalAlign === 'top'
                  ? 'flex-start'
                  : box.verticalAlign === 'bottom'
                  ? 'flex-end'
                  : 'center'

              const textDecoration = [
                box.underline ? 'underline' : '',
                box.strikethrough ? 'line-through' : '',
              ]
                .filter(Boolean)
                .join(' ') || 'none'

              return (
                <div
                  key={box.id}
                  style={{
                    position: 'absolute',
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    ...(box.height != null
                      ? { height: `${box.height}%`, overflow: 'hidden' }
                      : { minHeight: `${box.fontSize * 1.6}px` }),
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent,
                    cursor: isEditing ? 'text' : 'move',
                    outline: isSelected ? '2px solid #3b82f6' : 'none',
                    outlineOffset: '2px',
                    borderRadius: '2px',
                    userSelect: isEditing ? 'text' : 'none',
                    zIndex: isSelected ? 10 : 5,
                  }}
                  onPointerDown={(e) => {
                    if (isEditing) return // let contentEditable handle it
                    e.stopPropagation()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setSelectedId(box.id)
                    if (!canvasRef.current) return
                    dragState.current = {
                      mode: 'move',
                      resizeHandle: null,
                      boxId: box.id,
                      startPointerX: e.clientX,
                      startPointerY: e.clientY,
                      startBoxX: box.x,
                      startBoxY: box.y,
                      startBoxWidth: box.width,
                      startBoxHeight: 0,
                      snapshot: [...textBoxesRef.current],
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedId(box.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setSelectedId(box.id)
                    editStartSnapshotRef.current = [...textBoxesRef.current]
                    setEditingId(box.id)
                  }}
                >
                  <div
                    ref={(el) => {
                      if (el) contentEditableRefs.current.set(box.id, el)
                      else contentEditableRefs.current.delete(box.id)
                    }}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    style={{
                      fontFamily: box.fontFamily,
                      fontSize: `${box.fontSize}px`,
                      color: box.color,
                      fontWeight: box.bold ? 700 : 400,
                      fontStyle: box.italic ? 'italic' : 'normal',
                      textDecoration,
                      textAlign: box.textAlign,
                      lineHeight: 1.3,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      outline: 'none',
                      padding: '2px 4px',
                      textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                      minWidth: '1em',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setEditingId(null)
                      }
                    }}
                    onBlur={(e) => {
                      if (editStartSnapshotRef.current) {
                        pushHistory(editStartSnapshotRef.current)
                        editStartSnapshotRef.current = null
                      }
                      const newText = e.currentTarget.innerText
                      updateBox(box.id, 'text', newText)
                      setEditingId(null)
                    }}
                  >
                    {isEditing ? undefined : box.text}
                  </div>

                  {/* Corner resize handles — visible only when selected and not editing */}
                  {isSelected && !isEditing && (
                    (['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => {
                      const isTop = handle.startsWith('n')
                      const isLeft = handle.endsWith('w')
                      const cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'
                      return (
                        <div
                          key={handle}
                          style={{
                            position: 'absolute',
                            [isTop ? 'top' : 'bottom']: 3,
                            [isLeft ? 'left' : 'right']: 3,
                            width: 10,
                            height: 10,
                            background: '#ffffff',
                            border: '2px solid #3b82f6',
                            borderRadius: 2,
                            cursor,
                            zIndex: 20,
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            e.currentTarget.setPointerCapture(e.pointerId)
                            const containerEl = e.currentTarget.parentElement
                            const canvasEl = canvasRef.current
                            const renderedHeightPct = containerEl && canvasEl
                              ? (containerEl.offsetHeight / canvasEl.offsetHeight) * 100
                              : 20
                            dragState.current = {
                              mode: 'resize',
                              resizeHandle: handle,
                              boxId: box.id,
                              startPointerX: e.clientX,
                              startPointerY: e.clientY,
                              startBoxX: box.x,
                              startBoxY: box.y,
                              startBoxWidth: box.width,
                              startBoxHeight: box.height ?? renderedHeightPct,
                              snapshot: [...textBoxesRef.current],
                            }
                          }}
                          onPointerMove={handleCanvasPointerMove}
                          onPointerUp={handleCanvasPointerUp}
                        />
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom navigation                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>

        <button
          type="button"
          onClick={() => router.push(`/host/events/${eventId}/layout`)}
          className="ml-auto text-sm text-gray-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
        >
          Skip for now
        </button>

        <button
          type="button"
          onClick={() => void handleNext()}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Next: Choose Layout'}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Keep-text confirmation dialog                                        */}
      {/* ------------------------------------------------------------------ */}
      {pendingSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-800">Replace your text?</h3>
            <p className="text-sm text-gray-500">
              This sample comes with its own text layout. Do you want to keep the text you've written or use the sample's text?
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setPendingSample(null)}
              >
                Keep my text
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
                onClick={() => {
                  setTextBoxes(pendingSample.text_overlays as TextBox[])
                  setUserHasEditedText(false)
                  setPendingSample(null)
                }}
              >
                Use sample text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Background library modal                                             */}
      {/* ------------------------------------------------------------------ */}
      {showBgModal && (
        <BgModal
          onClose={() => setShowBgModal(false)}
          onSelectGradient={(gradient) => {
            setBgGradient(gradient)
            setBgUrl(null)
            localStorage.setItem(`card-gradient-${eventId}`, gradient)
            localStorage.removeItem(`card-bg-${eventId}`)
            setShowBgModal(false)
          }}
          onSelectSample={(sample) => {
            setBgUrl(sample.background_image_url)
            setBgGradient(GRADIENT_PRESETS[0]!)
            localStorage.setItem(`card-bg-${eventId}`, sample.background_image_url)
            localStorage.removeItem(`card-gradient-${eventId}`)
            setShowBgModal(false)
            if (sample.text_overlays && sample.text_overlays.length > 0) {
              if (userHasEditedText) {
                setPendingSample(sample)
              } else {
                setTextBoxes(sample.text_overlays as TextBox[])
                setUserHasEditedText(false)
              }
            }
          }}
        />
      )}
    </div>
  )
}
