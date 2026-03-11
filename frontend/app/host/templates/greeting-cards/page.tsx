'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getGreetingCardSamplesForStudio, type GreetingCardSample } from '@/lib/invite/api'
import { logError } from '@/lib/error-handler'

interface MeResponse {
  id: number
  email: string
  name: string
  is_staff?: boolean
}

export default function GreetingCardSamplesPage() {
  const router = useRouter()
  const [samples, setSamples] = useState<GreetingCardSample[]>([])
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      if (!token) { router.push('/host/login'); return }
      try {
        const meRes = await api.get<MeResponse>('/api/auth/me/')
        if (cancelled) return
        if (!meRes.data?.is_staff) { router.push('/host/dashboard'); return }
        setIsStaff(true)
        const list = await getGreetingCardSamplesForStudio()
        if (cancelled) return
        setSamples(list)
      } catch (e: any) {
        if (cancelled) return
        logError('Greeting card samples list failed', e)
        if (e?.response?.status === 401) router.push('/host/login')
        else if (e?.response?.status === 403) router.push('/host/dashboard')
        setSamples([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [router])

  if (loading || isStaff === null) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-eco-green">Greeting Card Samples</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Curate card backgrounds with placeholder text for hosts to use in the card designer.
            </p>
          </div>
          <Link href="/host/templates/greeting-cards/new">
            <Button className="bg-eco-green hover:bg-green-600 text-white">New sample</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Samples</CardTitle>
            <CardDescription>All greeting card samples. Hosts see only active ones.</CardDescription>
          </CardHeader>
          <CardContent>
            {samples.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">
                No samples yet. Create one with &quot;New sample&quot;.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Preview</th>
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">Tags</th>
                      <th className="pb-2 pr-4 font-medium">Overlays</th>
                      <th className="pb-2 pr-4 font-medium">Active</th>
                      <th className="pb-2 pr-4 font-medium">Created by</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((s) => (
                      <tr key={s.id} className="border-b">
                        <td className="py-3 pr-4">
                          {s.background_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.background_image_url}
                              alt={s.name}
                              className="w-12 rounded object-cover"
                              style={{ aspectRatio: '9 / 16' }}
                            />
                          ) : (
                            <div className="w-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs" style={{ aspectRatio: '9 / 16' }}>
                              —
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-medium">{s.name}</td>
                        <td className="py-3 pr-4 text-gray-600">
                          {s.tags.length > 0 ? s.tags.join(', ') : '—'}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{s.text_overlays.length}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={s.is_active ? 'success' : 'warning'}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{s.created_by_name ?? '—'}</td>
                        <td className="py-3">
                          <Link href={`/host/templates/greeting-cards/${s.id}/edit`}>
                            <Button variant="outline" size="sm">Edit</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex gap-3">
          <Link href="/host/templates">
            <Button variant="outline">← Template Studio</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
