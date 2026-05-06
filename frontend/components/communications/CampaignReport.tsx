'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getCampaigns,
  getCampaignReport,
  MessageCampaign,
  CampaignRecipient,
  CampaignStatus,
  RecipientStatus,
} from '@/lib/api'

interface Props {
  eventId: number
  campaign: MessageCampaign
  onClose: () => void
}

type FilterTab = 'all' | RecipientStatus

function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const styles: Record<RecipientStatus, string> = {
    pending:   'bg-gray-100 text-gray-600',
    sent:      'bg-blue-100 text-blue-700',
    delivered: 'bg-teal-100 text-teal-700',
    read:      'bg-eco-green text-white',
    failed:    'bg-red-100 text-red-700',
    skipped:   'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: 'whatsapp' | 'email' }) {
  return channel === 'email' ? (
    <span className="px-2 py-0.5 text-xs rounded font-semibold bg-blue-100 text-blue-700">Email</span>
  ) : (
    <span className="px-2 py-0.5 text-xs rounded font-semibold bg-green-100 text-green-700">WhatsApp</span>
  )
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const TERMINAL_STATUSES: CampaignStatus[] = ['completed', 'failed', 'cancelled']

export default function CampaignReport({ eventId, campaign, onClose }: Props) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState<CampaignStatus>(campaign.status)
  const [liveCampaign, setLiveCampaign] = useState<MessageCampaign>(campaign)

  const isEmail = liveCampaign.channel === 'email'

  const fetchReport = async () => {
    try {
      const { results, count } = await getCampaignReport(
        eventId,
        liveCampaign.id,
        filter === 'all' ? undefined : filter
      )
      setRecipients(results)
      setTotal(count)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const fetchLiveStatus = async () => {
    try {
      const all = await getCampaigns(eventId)
      const updated = all.find(c => c.id === campaign.id)
      if (updated) {
        setLiveStatus(updated.status)
        setLiveCampaign(updated)
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    setLoading(true)
    fetchReport()
  }, [filter, campaign.id])

  useEffect(() => {
    if (TERMINAL_STATUSES.includes(liveStatus)) return
    const interval = setInterval(() => {
      fetchReport()
      fetchLiveStatus()
    }, 10000)
    return () => clearInterval(interval)
  }, [liveStatus, filter])

  const skippedCount =
    liveCampaign.qualified_count > 0
      ? liveCampaign.qualified_count - liveCampaign.total_recipients
      : 0

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',       label: 'All',       count: liveCampaign.total_recipients },
    { key: 'sent',      label: 'Sent',      count: liveCampaign.sent_count },
    { key: 'delivered', label: 'Delivered', count: liveCampaign.delivered_count },
    { key: 'read',      label: 'Read',      count: liveCampaign.read_count },
    { key: 'failed',    label: 'Failed',    count: liveCampaign.failed_count },
    { key: 'skipped',   label: 'Skipped',   count: skippedCount },
  ]

  const contactHeader = isEmail ? 'Email' : 'Phone'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white border-2 border-eco-green-light max-w-3xl w-full max-h-[85vh] flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-lg truncate">
                {liveCampaign.name}
              </CardTitle>
              <ChannelBadge channel={liveCampaign.channel} />
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Qualified vs sent summary */}
          {liveCampaign.qualified_count > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{liveCampaign.qualified_count}</span> matched filter
              {skippedCount > 0 && (
                <> &mdash; <span className="text-amber-600 font-medium">{skippedCount} skipped</span> (no {isEmail ? 'email' : 'phone'})</>
              )}
              {' · '}
              <span className="font-medium text-gray-700">{liveCampaign.total_recipients}</span> contacted
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mt-3">
            {tabs.map(tab => (
              <Button
                key={tab.key}
                size="sm"
                variant={filter === tab.key ? 'default' : 'outline'}
                onClick={() => setFilter(tab.key)}
                className={
                  filter === tab.key
                    ? 'bg-eco-green hover:bg-green-600 text-white'
                    : 'border-eco-green text-eco-green hover:bg-eco-green-light'
                }
              >
                {tab.label}{' '}
                <span className="ml-1 opacity-70">({tab.count})</span>
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto flex-1 p-0">
          {loading ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading...</p>
          ) : recipients.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No recipients found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Guest</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">{contactHeader}</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Sent</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Delivered</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recipients.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.guest_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {isEmail ? (r.email || '—') : (r.phone || '—')}
                    </td>
                    <td className="px-4 py-2.5">
                      <RecipientStatusBadge status={r.status} />
                      {r.error_message && (
                        <p className="text-xs text-red-500 mt-0.5">{r.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{fmt(r.sent_at)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{fmt(r.delivered_at)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{fmt(r.read_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
