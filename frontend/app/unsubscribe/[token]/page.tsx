'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

type State = 'verifying' | 'confirmed' | 'unsubscribed' | 'error'

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>('verifying')
  const [submitting, setSubmitting] = useState(false)

  // On mount: validate the token via GET (read-only, does not unsubscribe yet)
  useEffect(() => {
    if (!token) return
    api
      .get(`/api/notifications/unsubscribe/${token}/`)
      .then(() => setState('confirmed'))
      .catch(() => setState('error'))
  }, [token])

  const handleUnsubscribe = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await api.post(`/api/notifications/unsubscribe/${token}/`)
      setState('unsubscribed')
    } catch {
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border-2 border-eco-green-light p-8 max-w-md w-full text-center">
        {state === 'verifying' && (
          <p className="text-eco-green text-lg">Verifying link…</p>
        )}

        {state === 'confirmed' && (
          <>
            <h1 className="text-2xl font-bold text-eco-green mb-2">Unsubscribe from marketing emails?</h1>
            <p className="text-gray-600 mb-6">
              You will stop receiving product updates and tips from Ekfern. Transactional emails
              (RSVP alerts, gift notifications) are controlled separately in your settings.
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={submitting}
              className="bg-eco-green text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Unsubscribing…' : 'Confirm unsubscribe'}
            </button>
          </>
        )}

        {state === 'unsubscribed' && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-eco-green mb-2">Unsubscribed</h1>
            <p className="text-gray-600 mb-6">
              You have been unsubscribed from Ekfern marketing emails.
            </p>
            <Link
              href="/host/profile"
              className="inline-block bg-eco-green text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              Manage all notification settings
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-4xl mb-4">✗</div>
            <h1 className="text-2xl font-bold text-gray-700 mb-2">Link not found</h1>
            <p className="text-gray-600 mb-6">
              This unsubscribe link is invalid or has already been used.
            </p>
            <Link
              href="/host/profile"
              className="inline-block bg-eco-green text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              Manage notification settings
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
