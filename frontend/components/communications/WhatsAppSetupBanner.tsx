'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/error-handler'

interface WhatsAppStatus {
  enabled: boolean
  configured: boolean
}

interface TestSendResult {
  success: boolean
  whatsapp_message_id?: string
  error?: string
}

export default function WhatsAppSetupBanner() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('Hello! This is a test message from Ekfern.')
  const [mode, setMode] = useState<'freeform' | 'approved_template'>('freeform')
  const [templateName, setTemplateName] = useState('')
  const [language, setLanguage] = useState('en')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TestSendResult | null>(null)

  useEffect(() => {
    api.get<WhatsAppStatus>('/api/events/whatsapp/status/').then((r) => setStatus(r.data)).catch(() => {})
    api.get('/api/auth/me/').then((r) => { if (r.data?.is_staff) setIsStaff(true) }).catch(() => {})
  }, [])

  if (!isStaff || !status) return null

  const isReady = status.enabled && status.configured

  async function handleTestSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)
    try {
      const res = await api.post<TestSendResult>('/api/events/whatsapp/test-send/', {
        to_phone: phone.trim(),
        message_body: message.trim(),
        message_mode: mode,
        meta_template_name: templateName.trim() || undefined,
        meta_template_language: language,
      })
      setResult(res.data)
    } catch (err: unknown) {
      setResult({ success: false, error: getErrorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`rounded-lg border mb-6 ${isReady ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-sm font-medium text-gray-800">
            WhatsApp:{' '}
            {!status.enabled
              ? 'Disabled (WHATSAPP_ENABLED=False)'
              : !status.configured
              ? 'Enabled but not configured — set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN'
              : 'Ready'}
          </span>
          <span className="text-xs text-gray-500 ml-1">(staff only)</span>
        </div>
        <span className="text-xs text-gray-500">{expanded ? '▲ Hide' : '▼ Test send'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-3">
          {!isReady ? (
            <div className="text-sm text-yellow-800 space-y-1">
              <p className="font-medium">Required environment variables:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5 font-mono text-xs">
                <li>WHATSAPP_ENABLED=True</li>
                <li>WHATSAPP_PHONE_NUMBER_ID=&lt;from Meta Business Manager&gt;</li>
                <li>WHATSAPP_ACCESS_TOKEN=&lt;permanent or temp token&gt;</li>
                <li>WHATSAPP_APP_SECRET=&lt;for webhook verification&gt;</li>
              </ul>
              <p className="text-xs mt-2 text-gray-600">
                Get these from{' '}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Meta for Developers
                </a>{' '}
                → your app → WhatsApp → API Setup.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTestSend} className="space-y-3 max-w-lg">
              <p className="text-xs text-gray-600">
                Send a single message to verify your WhatsApp credentials end-to-end.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Recipient phone <span className="font-normal text-gray-500">(+CCXXXXXXXXXX)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'freeform' | 'approved_template')}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="freeform">Free-form (only valid in 24h window)</option>
                  <option value="approved_template">Approved template</option>
                </select>
              </div>

              {mode === 'approved_template' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Template name</label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="hello_world"
                      required
                      className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="en">en</option>
                      <option value="en_US">en_US</option>
                      <option value="hi">hi</option>
                      <option value="ta">ta</option>
                      <option value="te">te</option>
                      <option value="mr">mr</option>
                      <option value="kn">kn</option>
                      <option value="gu">gu</option>
                      <option value="bn">bn</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message body</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  required
                  maxLength={1024}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
                <p className="text-xs text-gray-400 text-right">{message.length}/1024</p>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                {sending ? 'Sending…' : 'Send test message'}
              </button>

              {result && (
                <div className={`text-sm rounded px-3 py-2 ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {result.success ? (
                    <>
                      <span className="font-medium">Sent!</span>
                      {result.whatsapp_message_id && (
                        <span className="ml-2 font-mono text-xs text-green-600">
                          WAMID: {result.whatsapp_message_id}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Failed: </span>
                      {result.error}
                    </>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  )
}
