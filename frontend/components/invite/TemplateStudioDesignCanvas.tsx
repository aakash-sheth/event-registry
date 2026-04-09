'use client'

import React, { useState, useEffect } from 'react'
import { InviteConfig, Tile } from '@/lib/invite/schema'
import { getTheme } from '@/lib/invite/themes'
import { Input } from '@/components/ui/input'
import TileList from '@/components/invite/tiles/TileList'
import TileSettingsList from '@/components/invite/tiles/TileSettingsList'

export interface DummyEventLike {
  title: string
  date?: string
  city?: string
  slug: string
  has_rsvp: boolean
  has_registry: boolean
}

interface TemplateStudioDesignCanvasProps {
  config: InviteConfig
  setConfig: React.Dispatch<React.SetStateAction<InviteConfig>>
  eventLike: DummyEventLike
  /** Pass 0 for template studio (no real event); image upload may not work */
  eventIdForTiles: number
}

export default function TemplateStudioDesignCanvas({
  config,
  setConfig,
  eventLike,
  eventIdForTiles,
}: TemplateStudioDesignCanvasProps) {
  const [previewOrder, setPreviewOrder] = useState<Map<string, number>>(new Map())
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [allTilesExpanded, setAllTilesExpanded] = useState(false)

  useEffect(() => {
    if (config.tiles?.length) {
      const m = new Map<string, number>()
      config.tiles.forEach((t, i) => m.set(t.id, t.order ?? i))
      setPreviewOrder(m)
      setSelectedTileId((prev) => {
        const first = config.tiles!.find((t) => t.enabled)
        return prev ?? first?.id ?? null
      })
    }
  }, [config.tiles])

  const sortedTiles: Tile[] = config.tiles?.length
    ? [...config.tiles].sort((a, b) => {
        const orderA = previewOrder.get(a.id) ?? a.previewOrder ?? a.order ?? 0
        const orderB = previewOrder.get(b.id) ?? b.previewOrder ?? b.order ?? 0
        return orderA - orderB
      })
    : []

  const handleTileReorder = (tiles: Tile[]) => {
    const newOrder = new Map<string, number>()
    tiles.forEach((t, i) => newOrder.set(t.id, i))
    setPreviewOrder(newOrder)
    setConfig((prev) => ({
      ...prev,
      tiles: tiles.map((t, i) => ({ ...t, order: i })),
    }))
  }

  const handleTileUpdate = (tile: Tile) => {
    setConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles || []).map((t) => (t.id === tile.id ? tile : t)),
    }))
  }

  const handleTileToggle = (tileId: string, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles || []).map((t) => (t.id === tileId ? { ...t, enabled } : t)),
    }))
  }

  const handleOverlayToggle = (tileId: string, targetTileId: string | undefined) => {
    setConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles || []).map((t) =>
        t.id === tileId ? { ...t, overlayTargetId: targetTileId } : t
      ),
    }))
  }

  const displayBackgroundColor =
    config.customColors?.backgroundColor ?? getTheme(config?.themeId ?? 'classic-noir').palette.bg

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 w-full items-start">
      <div className="lg:col-span-3 space-y-4 w-full min-w-0 pt-4 sm:pt-6">
        <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
          <h2 className="text-lg font-semibold text-eco-green mb-4">Page Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Page Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={displayBackgroundColor}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      customColors: { ...prev.customColors, backgroundColor: e.target.value },
                    }))
                  }
                  className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                />
                <Input
                  type="text"
                  value={displayBackgroundColor}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      customColors: { ...prev.customColors, backgroundColor: e.target.value },
                    }))
                  }
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
              <p className="text-sm font-semibold text-eco-green">Guest motions</p>
              <p className="text-xs text-gray-500 -mt-2">
                Saved on the template and applied when hosts use this design (hosts can still override on their event).
              </p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="block text-sm font-medium">Opening animation</label>
                  <p className="text-xs text-gray-500 mt-0.5">Envelope when guests open the invite</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.animations?.envelope !== false}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      animations: { ...prev.animations, envelope: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 shrink-0 text-eco-green focus:ring-eco-green border-gray-300 rounded"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="block text-sm font-medium">Tile edge fade while scrolling</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tiles fade near the top and bottom of the guest&apos;s screen
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.animations?.tileViewportFade === true}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      animations: {
                        ...prev.animations,
                        tileViewportFade: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 shrink-0 text-eco-green focus:ring-eco-green border-gray-300 rounded"
                />
              </div>
              {config.animations?.tileViewportFade === true && (
                <div>
                  <label className="block text-sm font-medium mb-2">Fade band depth (px)</label>
                  <Input
                    type="number"
                    min={4}
                    max={120}
                    step={1}
                    value={config.animations?.tileViewportFadeInsetPx ?? 10}
                    onChange={(e) => {
                      const raw = parseInt(e.target.value, 10)
                      const n = Number.isFinite(raw) ? Math.min(120, Math.max(4, raw)) : 10
                      setConfig((prev) => ({
                        ...prev,
                        animations: {
                          ...prev.animations,
                          tileViewportFadeInsetPx: n,
                        },
                      }))
                    }}
                    className="w-full max-w-[8rem]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Vertical inset from viewport top and bottom where fading ramps to full opacity.
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-green rounded-md p-2 -m-2"
              >
                <h3 className="text-sm font-semibold text-eco-green">Advanced Settings</h3>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAdvancedSettings && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Background Texture</label>
                    <select
                      value={config.texture?.type || 'none'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          texture: {
                            ...prev.texture,
                            type: e.target.value as any,
                            intensity: prev.texture?.intensity || 40,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                    >
                      <option value="none">None</option>
                      <option value="paper-grain">Paper Grain</option>
                      <option value="linen">Linen</option>
                      <option value="canvas">Canvas</option>
                      <option value="parchment">Parchment</option>
                      <option value="vintage-paper">Vintage Paper</option>
                      <option value="silk">Silk</option>
                      <option value="marble">Marble</option>
                    </select>
                  </div>
                  {config.texture?.type && config.texture.type !== 'none' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Texture Intensity: {config.texture?.intensity || 40}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.texture?.intensity || 40}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            texture: {
                              ...prev.texture!,
                              intensity: parseInt(e.target.value, 10),
                            },
                          }))
                        }
                        className="w-full"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">Texture image (optional)</label>
                    <Input
                      type="url"
                      value={config.texture?.imageUrl || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          texture: {
                            ...prev.texture,
                            type: prev.texture?.type || 'none',
                            intensity: prev.texture?.intensity || 40,
                            imageUrl: e.target.value.trim() || undefined,
                          },
                        }))
                      }
                      placeholder="https://… (e.g. marble, watercolor)"
                      className="w-full"
                    />
                    {config.texture?.imageUrl && (
                      <div className="mt-2">
                        <label className="text-xs font-medium text-gray-600">Blend</label>
                        <select
                          value={config.texture?.textureBlend || 'overlay'}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              texture: { ...prev.texture!, textureBlend: e.target.value as 'overlay' | 'replace' },
                            }))
                          }
                          className="w-full text-sm border rounded px-2 py-1 mt-0.5"
                        >
                          <option value="overlay">Overlay on CSS texture</option>
                          <option value="replace">Replace CSS texture</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Spacing between tiles</label>
                    <select
                      value={config.spacing || 'normal'}
                      onChange={(e) => setConfig((prev) => ({ ...prev, spacing: e.target.value as 'tight' | 'normal' | 'spacious' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                    >
                      <option value="tight">Tight</option>
                      <option value="normal">Normal</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium">Page Border</label>
                      <input
                        type="checkbox"
                        checked={config.pageBorder?.enabled || false}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            pageBorder: {
                              ...prev.pageBorder,
                              enabled: e.target.checked,
                              style: prev.pageBorder?.style || 'solid',
                              color: prev.pageBorder?.color || '#D1D5DB',
                              width: prev.pageBorder?.width || 2,
                            },
                          }))
                        }
                        className="w-4 h-4 text-eco-green focus:ring-eco-green border-gray-300 rounded"
                      />
                    </div>
                    {config.pageBorder?.enabled && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">Border Style</label>
                          <select
                            value={config.pageBorder?.style || 'solid'}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                pageBorder: { ...prev.pageBorder!, style: e.target.value as any },
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                          >
                            <option value="solid">Solid</option>
                            <option value="dotted">Dotted</option>
                            <option value="dashed">Dashed</option>
                            <option value="double">Double</option>
                            <option value="groove">Groove</option>
                            <option value="ridge">Ridge</option>
                            <option value="inset">Inset</option>
                            <option value="outset">Outset</option>
                            <option value="intaglio">Intaglio (Decorative)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Border Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={config.pageBorder?.color || '#D1D5DB'}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  pageBorder: { ...prev.pageBorder!, color: e.target.value },
                                }))
                              }
                              className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={config.pageBorder?.color || '#D1D5DB'}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  pageBorder: { ...prev.pageBorder!, color: e.target.value },
                                }))
                              }
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Border Width: {config.pageBorder?.width || 2}px
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="8"
                            value={config.pageBorder?.width || 2}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                pageBorder: {
                                  ...prev.pageBorder!,
                                  width: parseInt(e.target.value),
                                },
                              }))
                            }
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium mb-2">Frame image (optional)</label>
                    <Input
                      type="url"
                      value={config.pageFrame?.imageUrl || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          pageFrame: e.target.value.trim() ? { imageUrl: e.target.value.trim() } : undefined,
                        }))
                      }
                      placeholder="https://… (SVG or PNG with transparency)"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Full-page frame overlay (e.g. ornate border). Leave empty for none.</p>
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium mb-2">Corner decorations (optional)</label>
                    <p className="text-xs text-gray-500 mb-2">Image URLs for corner flourishes.</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Top left</label>
                        <Input type="url" value={config.cornerDecorations?.topLeft || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, topLeft: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Top right</label>
                        <Input type="url" value={config.cornerDecorations?.topRight || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, topRight: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Bottom left</label>
                        <Input type="url" value={config.cornerDecorations?.bottomLeft || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, bottomLeft: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Bottom right</label>
                        <Input type="url" value={config.cornerDecorations?.bottomRight || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, bottomRight: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-eco-green">
              Tile Settings
              {sortedTiles.length > 0 && (
                <span className="text-xs text-gray-500 font-normal ml-2">
                  ({sortedTiles.length} {sortedTiles.length === 1 ? 'tile' : 'tiles'})
                </span>
              )}
            </h2>
            <button
              onClick={() => setAllTilesExpanded(!allTilesExpanded)}
              className="text-xs text-eco-green hover:underline px-2 py-1 rounded hover:bg-eco-green-light transition-colors"
              type="button"
            >
              {allTilesExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
          {sortedTiles.length > 0 ? (
            <TileSettingsList
              tiles={sortedTiles}
              onReorder={handleTileReorder}
              onUpdate={handleTileUpdate}
              onToggle={handleTileToggle}
              onOverlayToggle={handleOverlayToggle}
              eventId={eventIdForTiles}
              hasRsvp={eventLike.has_rsvp}
              hasRegistry={eventLike.has_registry}
              forceExpanded={allTilesExpanded}
            />
          ) : (
            <p className="text-gray-500 text-sm">No tiles available</p>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 w-full min-w-0 overflow-x-hidden">
        <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-eco-green mb-2">
            Mobile Preview
            {sortedTiles.length > 0 && (
              <span className="text-xs text-gray-500 font-normal ml-2">
                ({sortedTiles.filter((t) => t.enabled).length} of {sortedTiles.length} enabled)
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-600 mb-3 sm:mb-4">
            Drag tiles to reorder. Sample event data is used for preview.
          </p>
          <div className="flex justify-center items-start w-full overflow-x-hidden">
            <div className="relative w-full flex justify-center" style={{ maxWidth: '100%' }}>
              <div
                className="bg-black shadow-2xl mx-auto"
                style={{
                  maxWidth: 'calc(100% - 16px)',
                  width: 'min(100%, 320px, 390px)',
                  borderRadius: 'clamp(1.5rem, 4vw, 3rem)',
                  padding: 'clamp(3px, 1vw, 6px)',
                }}
              >
                <div
                  className="bg-black relative"
                  style={{
                    borderRadius: 'clamp(1.25rem, 3.5vw, 2.75rem)',
                    padding: 'clamp(1px, 0.5vw, 3px)',
                  }}
                >
                  <div
                    className="absolute left-1/2 transform -translate-x-1/2 bg-black rounded-full z-20"
                    style={{
                      top: 'clamp(6px, 1.5vw, 12px)',
                      width: 'clamp(80px, 25vw, 126px)',
                      height: 'clamp(24px, 7.5vw, 37px)',
                    }}
                  />
                  <div
                    className="relative overflow-hidden bg-white flex flex-col w-full"
                    style={{
                      width: '100%',
                      aspectRatio: '1179 / 2556',
                      backgroundColor: displayBackgroundColor,
                      borderRadius: 'clamp(1.25rem, 3vw, 2.5rem)',
                    }}
                  >
                    <div
                      className="bg-transparent flex items-start justify-center flex-shrink-0"
                      style={{
                        height: 'clamp(30px, 8vw, 47px)',
                        paddingTop: 'clamp(4px, 1vw, 8px)',
                      }}
                    >
                      <div
                        className="bg-black rounded-full opacity-30"
                        style={{
                          width: 'clamp(80px, 25vw, 126px)',
                          height: 'clamp(24px, 7.5vw, 37px)',
                        }}
                      />
                    </div>
                    <div
                      className="overflow-y-auto flex-1 w-full overflow-x-hidden"
                      style={{ paddingBottom: '24px' }}
                    >
                      {sortedTiles.length > 0 ? (
                        <TileList
                          tiles={sortedTiles}
                          onReorder={handleTileReorder}
                          eventDate={eventLike.date}
                          eventSlug={eventLike.slug}
                          eventTitle={
                            (sortedTiles.find((t) => t.type === 'title')?.settings as { text?: string })?.text ||
                            eventLike.title
                          }
                          hasRsvp={eventLike.has_rsvp}
                          hasRegistry={eventLike.has_registry}
                          allowedSubEvents={[]}
                        />
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <p>No tiles</p>
                        </div>
                      )}
                    </div>
                    <div
                      className="absolute left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-full z-10"
                      style={{
                        bottom: 'clamp(4px, 1vw, 8px)',
                        width: 'clamp(90px, 28vw, 134px)',
                        height: 'clamp(3px, 0.8vw, 5px)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
