'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WhatsAppTemplate } from '@/lib/api'

interface TemplateListProps {
  templates: WhatsAppTemplate[]
  onEdit: (template: WhatsAppTemplate) => void
  onDelete: (template: WhatsAppTemplate) => void
  onArchive: (template: WhatsAppTemplate) => void
  onSetDefault?: (template: WhatsAppTemplate) => void
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  invitation: '📧 Invitation',
  reminder: '⏰ Reminder',
  update: '📢 Update',
  venue_change: '📍 Venue Change',
  time_change: '🕐 Time Change',
  thank_you: '🙏 Thank You',
  custom: '💬 Custom',
}

export default function TemplateList({
  templates,
  onEdit,
  onDelete,
  onArchive,
  onSetDefault,
}: TemplateListProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysAgo = (dateString: string | null | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => {
        const daysAgo = getDaysAgo(template.last_used_at)
        const previewText = template.template_text.substring(0, 100) + (template.template_text.length > 100 ? '...' : '')

        return (
          <Card
            key={template.id}
            className={`bg-white border-2 transition-shadow ${
              template.is_active
                ? 'border-eco-green-light hover:shadow-lg'
                : 'border-gray-300 opacity-75'
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg text-eco-green mb-1">
                    {template.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{MESSAGE_TYPE_LABELS[template.message_type] || '💬 Custom'}</span>
                    {template.is_default && (
                      <span className="px-2 py-0.5 bg-eco-green text-white text-xs rounded font-semibold">
                        Default
                      </span>
                    )}
                    {template.is_system_default && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-semibold">
                        System Default
                      </span>
                    )}
                    {!template.is_active && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                        Archived
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Preview */}
              <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                {previewText}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>Used {template.usage_count} time{template.usage_count !== 1 ? 's' : ''}</span>
                  {template.last_used_at && daysAgo !== null && (
                    <span>
                      {daysAgo === 0
                        ? 'Today'
                        : daysAgo === 1
                        ? 'Yesterday'
                        : `${daysAgo} days ago`}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {template.description && (
                <p className="text-xs text-gray-600 italic">
                  {template.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  onClick={() => onEdit(template)}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                  disabled={template.is_system_default || template.id === -1}
                  title={template.is_system_default || template.id === -1 ? 'System default templates cannot be edited' : ''}
                >
                  Edit
                </Button>
                {onSetDefault && !template.is_default && template.id !== -1 && !template.is_system_default && (
                  <Button
                    onClick={() => onSetDefault(template)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                  >
                    Set Default
                  </Button>
                )}
                <Button
                  onClick={() => onArchive(template)}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={template.is_system_default || template.id === -1}
                  title={template.is_system_default || template.id === -1 ? 'System default templates cannot be archived' : ''}
                >
                  {template.is_active ? 'Archive' : 'Activate'}
                </Button>
                <Button
                  onClick={() => onDelete(template)}
                  variant="outline"
                  size="sm"
                  className={`flex-1 ${
                    template.is_system_default || template.id === -1
                      ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                      : 'border-red-300 text-red-600 hover:bg-red-50'
                  }`}
                  disabled={template.is_system_default || template.id === -1}
                  title={template.is_system_default || template.id === -1 ? 'System default templates cannot be deleted' : ''}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

