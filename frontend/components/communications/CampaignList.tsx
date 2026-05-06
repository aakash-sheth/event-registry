'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getCampaigns,
  launchCampaign,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
  getWhatsAppStatus,
  MessageCampaign,
  CampaignChannel,
  CampaignStatus,
} from '@/lib/api'
import { useToast } from '@/components/ui/toast'

const OUTBOX_STATUSES: CampaignStatus[] = ['pending', 'sending']
const REPORTS_STATUSES: CampaignStatus[] = ['completed', 'failed', 'cancelled']

interface Props {
  eventId: number
  mode: 'outbox' | 'reports'
  channelFilter?: CampaignChannel | 'all'
  onNewCampaign: () => void
  onViewReport: (campaign: MessageCampaign) => void
  onEdit: (campaign: MessageCampaign) => void
  refreshKey?: number
}

function isScheduledFuture(campaign: MessageCampaign): boolean {
  return (
    campaign.status === 'sending' &&
    !!campaign.scheduled_at &&
    new Date(campaign.scheduled_at) > new Date()
  )
}

function StatusBadge({ campaign }: { campaign: MessageCampaign }) {
  if (isScheduledFuture(campaign)) {
    return (
      <span className="px-2 py-0.5 text-xs rounded font-semibold inline-flex items-center gap-1.5 bg-amber-100 text-amber-700">
        Scheduled
      </span>
    )
  }
  const styles: Record<CampaignStatus, string> = {
    pending:   'bg-gray-200 text-gray-700',
    sending:   'bg-blue-100 text-blue-700',
    completed: 'bg-eco-green text-white',
    failed:    'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<CampaignStatus, string> = {
    pending:   'Pending',
    sending:   'Sending',
    completed: 'Completed',
    failed:    'Failed',
    cancelled: 'Cancelled',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded font-semibold inline-flex items-center gap-1.5 ${styles[campaign.status]}`}>
      {campaign.status === 'sending' && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {labels[campaign.status]}
    </span>
  )
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function CampaignTimestamp({ campaign }: { campaign: MessageCampaign }) {
  if (campaign.scheduled_at && campaign.status === 'pending') {
    return (
      <p className="text-xs text-amber-600 mt-0.5">
        Scheduled for {formatDateTime(campaign.scheduled_at)}
      </p>
    )
  }
  if (campaign.started_at) {
    return (
      <p className="text-xs text-gray-400 mt-0.5">
        Sent {formatDateTime(campaign.started_at)}
        {campaign.completed_at && ` · Completed ${formatDateTime(campaign.completed_at)}`}
      </p>
    )
  }
  return (
    <p className="text-xs text-gray-400 mt-0.5">
      Created {formatDateTime(campaign.created_at)}
    </p>
  )
}

function filterLabel(campaign: MessageCampaign): string {
  const labels: Record<string, string> = {
    all:              'All guests',
    not_sent:         'Not yet invited',
    rsvp_yes:         'RSVP: Yes',
    rsvp_no:          'RSVP: No',
    rsvp_maybe:       'RSVP: Maybe',
    rsvp_pending:     'No RSVP yet',
    relationship:     `Relationship: ${campaign.filter_relationship}`,
    custom_selection: 'Custom selection',
  }
  return labels[campaign.guest_filter] ?? campaign.guest_filter
}

function ChannelBadge({ channel }: { channel: CampaignChannel }) {
  if (channel === 'email') {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-50 text-blue-600">
        Email
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-50 text-green-700">
      WhatsApp
    </span>
  )
}

export default function CampaignList({ eventId, mode, channelFilter = 'all', onNewCampaign, onViewReport, onEdit, refreshKey }: Props) {
  const [allCampaigns, setAllCampaigns] = useState<MessageCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [whatsappReady, setWhatsappReady] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    getWhatsAppStatus().then(s => setWhatsappReady(s.configured && s.enabled)).catch(() => {})
  }, [])

  const fetchCampaigns = async () => {
    try {
      const data = await getCampaigns(eventId)
      setAllCampaigns(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [eventId, refreshKey])

  // Poll every 10s when any campaign is sending
  useEffect(() => {
    const hasSending = allCampaigns.some(c => c.status === 'sending')
    if (!hasSending) return
    const interval = setInterval(async () => {
      try {
        const updated = await getCampaigns(eventId)
        setAllCampaigns(updated)
      } catch { /* silent */ }
    }, 10000)
    return () => clearInterval(interval)
  }, [allCampaigns, eventId])

  // Filter based on current tab + channel
  const statusFilter = mode === 'outbox' ? OUTBOX_STATUSES : REPORTS_STATUSES
  const visibleCampaigns = allCampaigns.filter(c =>
    statusFilter.includes(c.status) &&
    (channelFilter === 'all' || c.channel === channelFilter)
  )

  const handleLaunch = async (campaign: MessageCampaign) => {
    setActionLoading(campaign.id)
    try {
      await launchCampaign(eventId, campaign.id)
      showToast('Campaign launched — messages are being dispatched.', 'success')
      fetchCampaigns()
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed to launch campaign', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (campaign: MessageCampaign) => {
    setActionLoading(campaign.id)
    try {
      await cancelCampaign(eventId, campaign.id)
      showToast('Campaign cancelled.', 'info')
      fetchCampaigns()
    } catch {
      showToast('Failed to cancel campaign', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (campaign: MessageCampaign) => {
    if (!confirm(`Delete campaign "${campaign.name}"?`)) return
    setActionLoading(campaign.id)
    try {
      await deleteCampaign(eventId, campaign.id)
      setAllCampaigns(prev => prev.filter(c => c.id !== campaign.id))
      showToast('Campaign deleted.', 'info')
    } catch {
      showToast('Failed to delete campaign', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDuplicate = async (campaign: MessageCampaign) => {
    setActionLoading(campaign.id)
    try {
      const dup = await duplicateCampaign(eventId, campaign.id)
      setAllCampaigns(prev => [dup, ...prev])
      showToast(`"${dup.name}" is ready to edit.`, 'success')
    } catch {
      showToast('Failed to duplicate campaign', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm py-8 text-center">Loading campaigns...</div>
  }

  if (visibleCampaigns.length === 0) {
    return (
      <div className="text-center py-12">
        {mode === 'outbox' ? (
          <>
            <p className="text-gray-400 mb-4">Nothing in your outbox yet.</p>
            <Button onClick={onNewCampaign} className="bg-eco-green hover:bg-green-600 text-white">
              Send to guests
            </Button>
          </>
        ) : (
          <p className="text-gray-400">No completed sends yet. Launch a message from the Outbox.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleCampaigns.map(campaign => {
        const isLoading = actionLoading === campaign.id
        return (
          <Card key={campaign.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-900">{campaign.name}</p>
                    <ChannelBadge channel={campaign.channel} />
                  </div>
                  <p className="text-xs text-gray-500">{filterLabel(campaign)}</p>
                  <CampaignTimestamp campaign={campaign} />
                </div>
                <StatusBadge campaign={campaign} />
              </div>

              <div className="text-xs text-gray-400 flex flex-wrap gap-3 mb-3">
                <span>Recipients: <strong className="text-gray-600">{campaign.total_recipients}</strong></span>
                <span>Sent: <strong className="text-gray-600">{campaign.sent_count}</strong></span>
                <span>Delivered: <strong className="text-gray-600">{campaign.delivered_count}</strong></span>
                <span>Read: <strong className="text-gray-600">{campaign.read_count}</strong></span>
                {campaign.failed_count > 0 && (
                  <span className="text-red-500">Failed: <strong>{campaign.failed_count}</strong></span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {campaign.status === 'pending' && (
                  <>
                    <span
                      title={campaign.channel === 'whatsapp' && !whatsappReady ? 'WhatsApp sending is not available yet' : undefined}
                      className="inline-flex"
                    >
                      <Button
                        size="sm"
                        onClick={() => handleLaunch(campaign)}
                        disabled={isLoading || (campaign.channel === 'whatsapp' && !whatsappReady)}
                        className="bg-eco-green hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Launching...' : 'Launch'}
                      </Button>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => onEdit(campaign)} className="border-eco-green text-eco-green hover:bg-eco-green-light">
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicate(campaign)} disabled={isLoading}>
                      Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(campaign)} disabled={isLoading} className="text-red-600 hover:bg-red-50">
                      Delete
                    </Button>
                  </>
                )}
                {campaign.status === 'sending' && (
                  <Button size="sm" variant="outline" onClick={() => handleCancel(campaign)} disabled={isLoading} className="border-red-300 text-red-600 hover:bg-red-50">
                    Cancel
                  </Button>
                )}
                {(campaign.status === 'completed' || campaign.status === 'failed') && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onViewReport(campaign)} className="border-eco-green text-eco-green hover:bg-eco-green-light">
                      View Report
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicate(campaign)} disabled={isLoading}>
                      Duplicate
                    </Button>
                  </>
                )}
                {campaign.status === 'cancelled' && (
                  <Button size="sm" variant="ghost" onClick={() => handleDuplicate(campaign)} disabled={isLoading}>
                    Duplicate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
