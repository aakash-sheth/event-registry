'use client'

import { useEffect, useState } from 'react'
import {
  getMetaApprovedTemplates,
  createMetaApprovedTemplate,
  updateMetaApprovedTemplate,
  deleteMetaApprovedTemplate,
  MetaApprovedTemplate,
} from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { logError } from '@/lib/error-handler'

const MESSAGE_TYPES = [
  'invitation', 'reminder', 'update', 'venue_change', 'time_change', 'thank_you', 'custom',
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'mr', label: 'Marathi' },
  { value: 'kn', label: 'Kannada' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'bn', label: 'Bengali' },
]

const EMPTY_FORM = {
  display_name: '',
  description: '',
  preview_text: '',
  meta_template_name: '',
  meta_template_language: 'en',
  message_type: 'invitation',
  is_active: true,
}

export default function MetaTemplatesPage() {
  const [templates, setTemplates] = useState<MetaApprovedTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MetaApprovedTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  useEffect(() => { fetchTemplates() }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      setTemplates(await getMetaApprovedTemplates())
    } catch (err) {
      logError('Failed to fetch meta templates', err)
      showToast('Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (t: MetaApprovedTemplate) => {
    setEditing(t)
    setForm({
      display_name: t.display_name,
      description: t.description,
      preview_text: t.preview_text,
      meta_template_name: t.meta_template_name,
      meta_template_language: t.meta_template_language,
      message_type: t.message_type,
      is_active: t.is_active,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.display_name || !form.meta_template_name || !form.preview_text) {
      showToast('Display name, Meta template name, and preview text are required', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateMetaApprovedTemplate(editing.id, form)
        showToast('Template updated', 'success')
      } else {
        await createMetaApprovedTemplate(form)
        showToast('Template created', 'success')
      }
      setShowForm(false)
      fetchTemplates()
    } catch (err: any) {
      logError('Failed to save meta template', err)
      showToast(err?.response?.data?.meta_template_name?.[0] || 'Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: MetaApprovedTemplate) => {
    if (!confirm(`Delete "${t.display_name}"? This cannot be undone.`)) return
    try {
      await deleteMetaApprovedTemplate(t.id)
      showToast('Template deleted', 'success')
      fetchTemplates()
    } catch (err) {
      logError('Failed to delete meta template', err)
      showToast('Failed to delete template', 'error')
    }
  }

  const handleToggleActive = async (t: MetaApprovedTemplate) => {
    try {
      await updateMetaApprovedTemplate(t.id, { is_active: !t.is_active })
      showToast(t.is_active ? 'Template deactivated' : 'Template activated', 'success')
      fetchTemplates()
    } catch (err) {
      logError('Failed to toggle template', err)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">Meta-Approved Templates</h1>
            <p className="text-gray-500 text-sm mt-1">
              Staff-managed. These templates are registered with Meta Business Manager and available for bulk sending.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-eco-green text-white text-sm font-medium rounded-md hover:bg-green-600"
          >
            + Add Template
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading...</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-eco-green-light">
            <p className="text-gray-500 mb-4">No Meta-approved templates yet.</p>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-eco-green text-white text-sm font-medium rounded-md hover:bg-green-600"
            >
              Add your first template
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div
                key={t.id}
                className={`bg-white rounded-xl border-2 p-5 ${t.is_active ? 'border-eco-green-light' : 'border-gray-100 opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-eco-green">{t.display_name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {t.message_type}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">
                        {t.meta_template_name}
                      </span>
                      <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
                        {t.meta_template_language}
                      </span>
                      {!t.is_active && (
                        <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-500 mb-2">{t.description}</p>
                    )}
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
                      {t.preview_text}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(t)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="text-xs text-eco-green hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border-2 border-eco-green-light w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-eco-green">
                {editing ? 'Edit Template' : 'New Meta-Approved Template'}
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="e.g. Wedding Invitation"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta template name *</label>
                <input
                  type="text"
                  value={form.meta_template_name}
                  onChange={e => setForm(f => ({ ...f, meta_template_name: e.target.value }))}
                  placeholder="e.g. hello_world"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-eco-green"
                />
                <p className="text-xs text-gray-400 mt-1">Exact name registered in Meta Business Manager.</p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message type</label>
                  <select
                    value={form.message_type}
                    onChange={e => setForm(f => ({ ...f, message_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                  >
                    {MESSAGE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select
                    value={form.meta_template_language}
                    onChange={e => setForm(f => ({ ...f, meta_template_language: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preview text *</label>
                <textarea
                  value={form.preview_text}
                  onChange={e => setForm(f => ({ ...f, preview_text: e.target.value }))}
                  rows={4}
                  placeholder="Template body shown to hosts. Use [name], [event_title] etc."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief note for staff"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible to hosts)</label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-eco-green text-white text-sm font-medium rounded-md hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
