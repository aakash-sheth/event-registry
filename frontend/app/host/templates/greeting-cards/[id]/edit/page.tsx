'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { getGreetingCardSample, updateGreetingCardSample, deleteGreetingCardSample, uploadGreetingCardImage } from '@/lib/invite/api'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import { logError } from '@/lib/error-handler'

interface TextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
}

interface DragState {
  boxId: string
  startPointerX: number
  startPointerY: number
  startBoxX: number
  startBoxY: number
}

interface MeResponse { id: number; is_staff?: boolean }

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export default function EditGreetingCardSamplePage(): React.ReactElement {
  const params = useParams()
  const sampleId = Number(params.id)
  const router = useRouter()

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sampleId || isNaN(sampleId)) { router.push('/host/templates/greeting-cards'); return }
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) { router.push('/host/login'); return }

    Promise.all([
      api.get<MeResponse>('/api/auth/me/'),
      getGreetingCardSample(sampleId),
    ]).then(([meRes, sample]) => {
      if (!meRes.data?.is_staff) { router.push('/host/dashboard'); return }
      setName(sample.name)
      setDescription(sample.description ?? '')
      setTagsInput((sample.tags ?? []).join(', '))
      setIsActive(sample.is_active)
      setBgUrl(sample.background_image_url || null)
      setTextBoxes((sample.text_overlays ?? []) as TextBox[])
    }).catch((e: any) => {
      logError('Load greeting card sample failed', e)
      if (e?.response?.status === 401) router.push('/host/login')
      else if (e?.response?.status === 403 || e?.response?.status === 404) router.push('/host/templates/greeting-cards')
    }).finally(() => setLoading(false))
  }, [sampleId, router])

  const selectedBox = textBoxes.find((b) => b.id === selectedId) ?? null

  function updateBox<K extends keyof TextBox>(id: string, key: K, value: TextBox[K]): void {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: value } : b)))
  }
  function toggleProp(id: string, key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: !b[key] } : b)))
  }
  function deleteBox(id: string): void {
    setTextBoxes((prev) => prev.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (editingId === id) setEditingId(null)
  }
  function addTextBox(): void {
    const newBox: TextBox = {
      id: makeId(), text: 'Placeholder text', x: 10, y: 20, width: 80,
      fontFamily: "'Playfair Display', serif", fontSize: 32, color: '#ffffff',
      bold: false, italic: false, underline: false, strikethrough: false,
      textAlign: 'center', verticalAlign: 'middle',
    }
    setTextBoxes((prev) => [...prev, newBox])
    setSelectedId(newBox.id)
  }

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragState.current.startPointerX) / rect.width) * 100
    const dy = ((e.clientY - dragState.current.startPointerY) / rect.height) * 100
    const { boxId, startBoxX, startBoxY } = dragState.current
    setTextBoxes((prev) => prev.map((b) => b.id !== boxId ? b : { ...b, x: clamp(startBoxX + dx, 0, 100 - b.width), y: clamp(startBoxY + dy, 0, 95) }))
  }, [])
  const handleCanvasPointerUp = useCallback(() => { dragState.current = null }, [])

  async function handleUpload(file: File): Promise<void> {
    if (file.size > 20 * 1024 * 1024) { alert('Max file size is 20 MB.'); return }
    setUploading(true)
    try {
      const url = await uploadGreetingCardImage(file)
      setBgUrl(url)
    } catch (err) {
      logError('Upload failed', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!bgUrl) { setError('Background image is required.'); return }
    setSaving(true); setError(null)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      await updateGreetingCardSample(sampleId, {
        name: name.trim(), description: description.trim(),
        background_image_url: bgUrl, text_overlays: textBoxes,
        tags, is_active: isActive,
      })
      router.push('/host/templates/greeting-cards')
    } catch (err) {
      logError('Update greeting card sample failed', err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm('Delete this greeting card sample? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteGreetingCardSample(sampleId)
      router.push('/host/templates/greeting-cards')
    } catch (err) {
      logError('Delete greeting card sample failed', err)
      alert('Delete failed. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Lora:ital,wght@0,400;0,600;1,400&family=Poppins:wght@400;600&family=Open+Sans:wght@400;600&family=Montserrat:wght@400;600&family=Raleway:wght@400;600&display=swap');` }} />

      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-eco-green">Edit Greeting Card Sample</h1>
          <p className="text-xs text-gray-500 mt-0.5">Staff only</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="px-4 py-2 rounded-lg border border-red-300 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" onClick={() => router.push('/host/templates/greeting-cards')} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="px-4 py-2 rounded-lg bg-eco-green text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-600">{error}</div>}

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        <div className="lg:w-80 flex-shrink-0 bg-white border-r border-gray-200 p-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="wedding, floral, minimalist" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 text-eco-green" />
            <label htmlFor="is-active" className="text-sm font-medium text-gray-700">Active (visible to hosts)</label>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Background Image</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-eco-green hover:text-eco-green transition-colors disabled:opacity-50">
              {uploading ? 'Uploading…' : 'Replace image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleUpload(file) }} />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Text Overlays</p>
            <button type="button" onClick={addTextBox} className="w-full py-2 rounded-lg border border-blue-400 text-sm text-blue-600 hover:bg-blue-50 font-medium">
              + Add placeholder text
            </button>
            {textBoxes.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{textBoxes.length} overlay{textBoxes.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 bg-gray-100">
          {!bgUrl ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <p className="text-sm">Upload a background image to design overlays</p>
            </div>
          ) : (
            <div style={{ height: '72vh', aspectRatio: '9 / 16' }} className="relative select-none">
              <div
                ref={canvasRef}
                className="relative overflow-hidden rounded-2xl shadow-2xl"
                style={{ width: '100%', height: '100%' }}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
                onClick={(e) => { if (e.target === canvasRef.current || e.target === e.currentTarget) { setSelectedId(null); setEditingId(null) } }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bgUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                {textBoxes.map((box) => {
                  const isSelected = selectedId === box.id
                  const isEditing = editingId === box.id
                  const justifyContent = box.verticalAlign === 'top' ? 'flex-start' : box.verticalAlign === 'bottom' ? 'flex-end' : 'center'
                  const textDecoration = [box.underline ? 'underline' : '', box.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'
                  return (
                    <div
                      key={box.id}
                      style={{
                        position: 'absolute', left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`,
                        minHeight: `${box.fontSize * 1.6}px`, display: 'flex', flexDirection: 'column',
                        justifyContent, cursor: isEditing ? 'text' : 'move',
                        outline: isSelected ? '2px solid #3b82f6' : 'none', outlineOffset: '2px',
                        borderRadius: '2px', userSelect: isEditing ? 'text' : 'none', zIndex: isSelected ? 10 : 5,
                      }}
                      onPointerDown={(e) => {
                        if (isEditing) return
                        e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSelectedId(box.id)
                        if (!canvasRef.current) return
                        dragState.current = { boxId: box.id, startPointerX: e.clientX, startPointerY: e.clientY, startBoxX: box.x, startBoxY: box.y }
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(box.id) }}
                      onDoubleClick={(e) => { e.stopPropagation(); setSelectedId(box.id); setEditingId(box.id) }}
                    >
                      <div
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        style={{
                          fontFamily: box.fontFamily, fontSize: `${box.fontSize}px`, color: box.color,
                          fontWeight: box.bold ? 700 : 400, fontStyle: box.italic ? 'italic' : 'normal',
                          textDecoration, textAlign: box.textAlign, lineHeight: 1.3, whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word', outline: 'none', padding: '2px 4px',
                          textShadow: '0 1px 4px rgba(0,0,0,0.4)', minWidth: '1em',
                        }}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null) }}
                        onBlur={(e) => { updateBox(box.id, 'text', e.currentTarget.innerText); setEditingId(null) }}
                      >
                        {isEditing ? undefined : box.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedBox && (
        <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap overflow-x-auto">
          <select value={selectedBox.fontFamily} onChange={(e) => updateBox(selectedBox.id, 'fontFamily', e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1 bg-white max-w-[130px]">
            {FONT_OPTIONS.map((f) => (<option key={f.id} value={f.family}>{f.name}</option>))}
          </select>
          <div className="flex items-center gap-1">
            <input type="number" min={8} max={200} value={selectedBox.fontSize} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) updateBox(selectedBox.id, 'fontSize', clamp(v, 8, 200)) }} className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center" />
            <span className="text-xs text-gray-500">px</span>
          </div>
          <div className="w-px h-5 bg-gray-200 flex-none" />
          {(['bold', 'italic', 'underline', 'strikethrough'] as const).map((prop) => (
            <button key={prop} onClick={() => toggleProp(selectedBox.id, prop)} className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox[prop] ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
              {prop === 'bold' ? <b>B</b> : prop === 'italic' ? <i>I</i> : prop === 'underline' ? <u>U</u> : <s>S</s>}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 flex-none" />
          {(['left', 'center', 'right'] as const).map((align) => (
            <button key={align} onClick={() => updateBox(selectedBox.id, 'textAlign', align)} className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox.textAlign === align ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
              {align === 'left' ? '←' : align === 'center' ? '↔' : '→'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 flex-none" />
          <div className="flex items-center gap-1">
            <input type="color" value={selectedBox.color} onChange={(e) => updateBox(selectedBox.id, 'color', e.target.value)} className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5" />
            <input type="text" value={selectedBox.color} maxLength={7} onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateBox(selectedBox.id, 'color', v) }} className="w-24 text-xs border border-gray-300 rounded px-2 py-1 font-mono" placeholder="#ffffff" />
          </div>
          <div className="w-px h-5 bg-gray-200 flex-none" />
          <button onClick={() => deleteBox(selectedBox.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-sm">Delete</button>
        </div>
      )}
    </div>
  )
}
