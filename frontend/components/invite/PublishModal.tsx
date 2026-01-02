'use client'

import { useState } from 'react'
import { X, Copy, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { publishInvitePage } from '@/lib/invite/api'
import { logError } from '@/lib/error-handler'

interface PublishModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  onPublishChange: (isPublished: boolean) => void
  onExportImage?: () => void
}

export default function PublishModal({
  isOpen,
  onClose,
  slug,
  onPublishChange,
  onExportImage,
}: PublishModalProps) {
  const { showToast } = useToast()
  const [isPublished, setIsPublished] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${slug}`

  const handlePublish = async () => {
    if (!slug) {
      showToast('Event slug not found', 'error')
      return
    }
    
    setIsPublishing(true)
    try {
      const updated = await publishInvitePage(slug, true)
      setIsPublished(true)
      onPublishChange(true)
      showToast('Invite page published successfully!', 'success')
    } catch (error: any) {
      logError('Failed to publish invite page:', error)
      // Provide more specific error messages
      if (error.response?.status === 404) {
        showToast('Invite page not found. Please save your design first.', 'error')
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        showToast('You do not have permission to publish this invite page.', 'error')
      } else if (error.response?.data?.error) {
        // Show backend error message if available
        showToast(error.response.data.error, 'error')
      } else if (error.message) {
        showToast(`Failed to publish: ${error.message}`, 'error')
      } else {
        showToast('Failed to publish invite page. Please try again.', 'error')
      }
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      showToast('URL copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast('Failed to copy URL', 'error')
    }
  }

  const handleExport = () => {
    if (onExportImage) {
      onExportImage()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-2xl p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-eco-green mb-2">Publish Invite Page</h2>
            <p className="text-gray-600">
              Make your invitation page public and shareable
            </p>
          </div>

          {!isPublished ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Once published, your invite page will be accessible at:
              </p>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <code className="flex-1 text-sm text-gray-700 truncate">{publicUrl}</code>
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full bg-eco-green hover:bg-green-600 text-white"
              >
                {isPublishing ? 'Publishing...' : '🚀 Publish Now'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">✓ Published Successfully!</p>
                <p className="text-sm text-green-600 mt-1">
                  Your invite page is now live and shareable
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <code className="flex-1 text-sm text-gray-700 truncate">{publicUrl}</code>
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {onExportImage && (
                <Button
                  onClick={handleExport}
                  variant="outline"
                  className="w-full border-eco-green text-eco-green hover:bg-eco-green-light flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export as Image
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

