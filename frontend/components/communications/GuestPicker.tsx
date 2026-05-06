'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { logError } from '@/lib/error-handler'

export interface PickableGuest {
  id: number
  name: string
  phone: string
  guest_token?: string
  rsvp_status?: string | null
  invitation_sent?: boolean
  custom_fields?: Record<string, string>
}

interface Props {
  eventId: number
  onSelect: (guest: PickableGuest) => void
  onCancel: () => void
}

const RSVP_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Going', className: 'bg-green-100 text-green-700' },
  declined:  { label: 'Not going', className: 'bg-red-100 text-red-600' },
  maybe:     { label: 'Maybe', className: 'bg-yellow-100 text-yellow-700' },
}

export default function GuestPicker({ eventId, onSelect, onCancel }: Props) {
  const [guests, setGuests] = useState<PickableGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchGuests() {
      try {
        const response = await api.get(`/api/events/${eventId}/guests/`)
        const data = response.data
        const list: PickableGuest[] = Array.isArray(data)
          ? data
          : Array.isArray(data.guests)
          ? data.guests
          : []
        setGuests(list)
      } catch (err) {
        logError('GuestPicker: failed to fetch guests', err)
      } finally {
        setLoading(false)
      }
    }
    fetchGuests()
  }, [eventId])

  const filtered = guests.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.phone.includes(search)
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border-2 border-eco-green-light w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-eco-green mb-3">Who do you want to message?</h2>
          <input
            autoFocus
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
          />
        </div>

        {/* Guest list */}
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Loading guests...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              {search ? 'No guests match your search.' : 'No guests added yet.'}
            </p>
          ) : (
            filtered.map(guest => {
              const rsvp = guest.rsvp_status ? RSVP_BADGE[guest.rsvp_status] : null
              return (
                <button
                  key={guest.id}
                  onClick={() => onSelect(guest)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-eco-green-light transition-colors flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{guest.name}</p>
                    <p className="text-xs text-gray-400">{guest.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {guest.invitation_sent && (
                      <span className="text-xs text-gray-400">Invited</span>
                    )}
                    {rsvp && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rsvp.className}`}>
                        {rsvp.label}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
