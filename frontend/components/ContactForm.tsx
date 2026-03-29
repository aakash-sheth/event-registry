'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

interface FormState {
  name: string
  email: string
  subject: string
  message: string
}

export default function ContactForm() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')
    try {
      await api.post('/api/auth/contact/', form)
      setStatus('success')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Something went wrong. Please try emailing us directly.'
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-pastel-cream border border-pastel-green rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">✉️</div>
        <h3 className="text-xl font-bold text-bright-teal mb-2">Message sent!</h3>
        <p className="text-earth-brown">We'll get back to you within 24–48 hours.</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm text-bright-teal hover:underline"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-earth-brown mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="Your name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bright-teal focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-earth-brown mb-1" htmlFor="email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bright-teal focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-earth-brown mb-1" htmlFor="subject">
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          value={form.subject}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bright-teal focus:border-transparent bg-white"
        >
          <option value="">Select a topic…</option>
          <option value="Technical support">Technical support</option>
          <option value="Account or billing">Account or billing</option>
          <option value="Feature request">Feature request</option>
          <option value="Event planning help">Event planning help</option>
          <option value="Invite design help">Invite design help</option>
          <option value="Privacy or data">Privacy or data</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-earth-brown mb-1" htmlFor="message">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          value={form.message}
          onChange={handleChange}
          rows={5}
          placeholder="How can we help?"
          required
          className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-bright-teal focus:border-transparent resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full bg-bright-teal hover:bg-forest-green text-white font-semibold py-3 rounded-md transition-colors"
      >
        {status === 'submitting' ? 'Sending…' : 'Send Message'}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        We typically respond within 24–48 hours.
      </p>
    </form>
  )
}
