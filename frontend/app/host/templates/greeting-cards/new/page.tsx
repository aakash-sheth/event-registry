'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { createGreetingCardSample, uploadGreetingCardImage } from '@/lib/invite/api'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import { logError } from '@/lib/error-handler'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number | null  // % of canvas height, null = auto
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
}

interface MeResponse {
  id: number
  is_staff?: boolean
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewGreetingCardSamplePage(): React.ReactElement {
  const router = useRouter()

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentEditableRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const textBoxesRef = useRef<TextBox[]>([])
  useEffect(() => { textBoxesRef.current = textBoxes }, [textBoxes])

  // Auto-focus contentEditable when editing starts
  useEffect(() => {
    if (!editingId) return
    const el = contentEditableRefs.current.get(editingId)
    if (!el) return
    const text = textBoxesRef.current.find((b) => b.id === editingId)?.text ?? ''
    el.innerText = text
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }, [editingId])

  // Staff auth check
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) { router.push('/host/login'); return }
    api.get<MeResponse>('/api/auth/me/').then((res) => {
      if (!res.data?.is_staff) router.push('/host/dashboard')
    }).catch(() => router.push('/host/login'))
  }, [router])

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
      id: makeId(),
      text: 'Placeholder text',
      x: 10, y: 20, width: 80, height: null,
      fontFamily: "'Playfair Display', serif",
      fontSize: 32,
      color: '#ffffff',
      bold: false, italic: false, underline: false, strikethrough: false,
      textAlign: 'center',
      verticalAlign: 'middle',
    }
    setTextBoxes((prev) => [...prev, newBox])
    setSelectedId(newBox.id)
  }

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
            const dw = -dx
            newW = clamp(startBoxWidth + dw, 10, startBoxX + startBoxWidth)
            newX = startBoxX + startBoxWidth - newW
            newH = clamp(startBoxHeight + dy, 5, 100 - startBoxY)
          } else if (resizeHandle === 'ne') {
            newW = clamp(startBoxWidth + dx, 10, 100 - startBoxX)
            const dh = -dy
            newH = clamp(startBoxHeight + dh, 5, startBoxY + startBoxHeight)
            newY = startBoxY + startBoxHeight - newH
          } else if (resizeHandle === 'nw') {
            const dw = -dx
            newW = clamp(startBoxWidth + dw, 10, startBoxX + startBoxWidth)
            newX = startBoxX + startBoxWidth - newW
            const dh = -dy
            newH = clamp(startBoxHeight + dh, 5, startBoxY + startBoxHeight)
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

  const handleCanvasPointerUp = useCallback(() => { dragState.current = null }, [])

  async function handleUpload(file: File): Promise<void> {
    if (file.size > 20 * 1024 * 1024) { alert('Max file size is 20 MB.'); return }
    setUploading(true)
    try {
      const url = await uploadGreetingCardImage(file)
      setBgUrl(url)
    } catch (err) {
      logError('Greeting card image upload failed', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!bgUrl) { setError('Please upload a background image.'); return }
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      await createGreetingCardSample({
        name: name.trim(),
        description: description.trim(),
        background_image_url: bgUrl,
        text_overlays: textBoxes,
        tags,
        is_active: true,
        sort_order: 0,
      })
      router.push('/host/templates/greeting-cards')
    } catch (err) {
      logError('Create greeting card sample failed', err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Lora:ital,wght@0,400;0,600;1,400&family=Poppins:wght@400;600&family=Open+Sans:wght@400;600&family=Montserrat:wght@400;600&family=Raleway:wght@400;600&display=swap');` }} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-eco-green">New Greeting Card Sample</h1>
          <p className="text-xs text-gray-500 mt-0.5">Staff only — visible to hosts in the card designer</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/host/templates/greeting-cards')}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-eco-green text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save sample'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-600 flex-shrink-0">{error}</div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">
        {/* Left: metadata */}
        <div className="lg:w-80 flex-shrink-0 bg-white border-r border-gray-200 p-6 flex flex-col gap-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Floral Wedding"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description for staff reference"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="wedding, floral, minimalist"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Background Image <span className="text-red-500">*</span></p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-eco-green hover:text-eco-green transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : bgUrl ? 'Replace image' : 'Upload image or GIF'}
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
            {bgUrl && <p className="text-xs text-green-600 mt-1">Image uploaded ✓</p>}
          </div>

          {textBoxes.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs text-gray-400">{textBoxes.length} text overlay{textBoxes.length !== 1 ? 's' : ''} — click a box on the canvas to select</p>
            </div>
          )}
        </div>

        {/* Right: toolbar + canvas */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Always-visible text toolbar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap overflow-x-auto flex-shrink-0">
            <button
              onClick={addTextBox}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-400 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium flex-none"
            >
              + Add Text
            </button>

            <div className="w-px h-5 bg-gray-200 flex-none" />

            <div className={`flex items-center gap-2 flex-wrap transition-opacity ${selectedBox ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <select
                value={selectedBox?.fontFamily ?? FONT_OPTIONS[0]!.family}
                onChange={(e) => selectedBox && updateBox(selectedBox.id, 'fontFamily', e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white max-w-[130px]"
              >
                {FONT_OPTIONS.map((f) => (<option key={f.id} value={f.family}>{f.name}</option>))}
              </select>

              <div className="flex items-center gap-1">
                <input
                  type="number" min={8} max={200}
                  value={selectedBox?.fontSize ?? 32}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && selectedBox) updateBox(selectedBox.id, 'fontSize', clamp(v, 8, 200)) }}
                  className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                />
                <span className="text-xs text-gray-500">px</span>
              </div>

              <div className="w-px h-5 bg-gray-200 flex-none" />

              <button onClick={() => selectedBox && toggleProp(selectedBox.id, 'bold')} className={`px-2 py-1 rounded text-sm font-bold transition-colors ${selectedBox?.bold ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Bold">B</button>
              <button onClick={() => selectedBox && toggleProp(selectedBox.id, 'italic')} className={`px-2 py-1 rounded text-sm italic transition-colors ${selectedBox?.italic ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Italic">I</button>
              <button onClick={() => selectedBox && toggleProp(selectedBox.id, 'underline')} className={`px-2 py-1 rounded text-sm underline transition-colors ${selectedBox?.underline ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Underline">U</button>
              <button onClick={() => selectedBox && toggleProp(selectedBox.id, 'strikethrough')} className={`px-2 py-1 rounded text-sm line-through transition-colors ${selectedBox?.strikethrough ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Strikethrough">S</button>

              <div className="w-px h-5 bg-gray-200 flex-none" />

              {(['left', 'center', 'right'] as const).map((align) => (
                <button key={align} onClick={() => selectedBox && updateBox(selectedBox.id, 'textAlign', align)} title={`Align ${align}`} className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox?.textAlign === align ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                  {align === 'left' ? '←' : align === 'center' ? '↔' : '→'}
                </button>
              ))}

              <div className="w-px h-5 bg-gray-200 flex-none" />

              {(['top', 'middle', 'bottom'] as const).map((va) => (
                <button key={va} onClick={() => selectedBox && updateBox(selectedBox.id, 'verticalAlign', va)} title={`Vertical ${va}`} className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox?.verticalAlign === va ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                  {va === 'top' ? '↑' : va === 'middle' ? '↕' : '↓'}
                </button>
              ))}

              <div className="w-px h-5 bg-gray-200 flex-none" />

              <div className="flex items-center gap-1">
                <input type="color" value={selectedBox?.color ?? '#ffffff'} onChange={(e) => selectedBox && updateBox(selectedBox.id, 'color', e.target.value)} className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5" title="Text color" />
                <input type="text" value={selectedBox?.color ?? '#ffffff'} maxLength={7} onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v) && selectedBox) updateBox(selectedBox.id, 'color', v) }} className="w-24 text-xs border border-gray-300 rounded px-2 py-1 font-mono" placeholder="#ffffff" />
              </div>

              <div className="w-px h-5 bg-gray-200 flex-none" />

              <button onClick={() => selectedBox && deleteBox(selectedBox.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-sm transition-colors" title="Delete">Delete</button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 bg-gray-100 overflow-auto">
            {!bgUrl ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <p className="text-sm">Upload a background image to start designing</p>
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
                  onClick={(e) => {
                    if (e.target === canvasRef.current || e.target === e.currentTarget) {
                      setSelectedId(null); setEditingId(null)
                    }
                  }}
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
                          position: 'absolute',
                          left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`,
                          ...(box.height != null
                            ? { height: `${box.height}%`, overflow: 'hidden' }
                            : { minHeight: `${box.fontSize * 1.6}px` }),
                          display: 'flex', flexDirection: 'column', justifyContent,
                          cursor: isEditing ? 'text' : 'move',
                          outline: isSelected ? '2px solid #3b82f6' : 'none', outlineOffset: '2px',
                          borderRadius: '2px', userSelect: isEditing ? 'text' : 'none', zIndex: isSelected ? 10 : 5,
                        }}
                        onPointerDown={(e) => {
                          if (isEditing) return
                          e.stopPropagation()
                          e.currentTarget.setPointerCapture(e.pointerId)
                          setSelectedId(box.id)
                          if (!canvasRef.current) return
                          dragState.current = {
                            mode: 'move', resizeHandle: null,
                            boxId: box.id, startPointerX: e.clientX, startPointerY: e.clientY,
                            startBoxX: box.x, startBoxY: box.y, startBoxWidth: box.width, startBoxHeight: 0,
                          }
                        }}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(box.id) }}
                        onDoubleClick={(e) => { e.stopPropagation(); setSelectedId(box.id); setEditingId(box.id) }}
                      >
                        <div
                          ref={(el) => {
                            if (el) contentEditableRefs.current.set(box.id, el)
                            else contentEditableRefs.current.delete(box.id)
                          }}
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

                        {/* Corner resize handles */}
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
                                  width: 10, height: 10,
                                  background: '#ffffff', border: '2px solid #3b82f6',
                                  borderRadius: 2, cursor, zIndex: 20,
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
                                    mode: 'resize', resizeHandle: handle,
                                    boxId: box.id, startPointerX: e.clientX, startPointerY: e.clientY,
                                    startBoxX: box.x, startBoxY: box.y, startBoxWidth: box.width,
                                    startBoxHeight: box.height ?? renderedHeightPct,
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
