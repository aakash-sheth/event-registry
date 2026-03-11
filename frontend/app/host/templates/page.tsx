'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getInviteDesignTemplatesForStudio,
  type InviteDesignTemplateResponse,
} from '@/lib/invite/api'
import { logError } from '@/lib/error-handler'

interface MeResponse {
  id: number
  email: string
  name: string
  is_staff?: boolean
}

export default function TemplateStudioListPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<InviteDesignTemplateResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      if (!token) {
        router.push('/host/login')
        return
      }
      try {
        const meRes = await api.get<MeResponse>('/api/auth/me/')
        if (cancelled) return
        const staff = meRes.data?.is_staff === true
        setIsStaff(staff)
        if (!staff) {
          router.push('/host/dashboard')
          return
        }
        const list = await getInviteDesignTemplatesForStudio()
        if (cancelled) return
        setTemplates(list)
      } catch (e: any) {
        if (cancelled) return
        logError('Template Studio list failed', e)
        if (e?.response?.status === 401) {
          router.push('/host/login')
          return
        }
        if (e?.response?.status === 403) {
          router.push('/host/dashboard')
          return
        }
        setTemplates([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
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
            <h1 className="text-2xl font-bold text-eco-green">Template Studio</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Design invite templates for the host library. Only staff can access this page.
            </p>
          </div>
          <Link href="/host/templates/new">
            <Button className="bg-eco-green hover:bg-green-600 text-white">New template</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>All invite design templates. Edit or create new ones.</CardDescription>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">
                No templates yet. Create one with &quot;New template&quot;.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Preview</th>
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">Visibility</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Creator</th>
                      <th className="pb-2 pr-4 font-medium">Updated</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="py-3 pr-4">
                          {t.thumbnail ? (
                            <div className="relative w-16 h-20 rounded overflow-hidden bg-gray-100">
                              <Image
                                src={t.thumbnail}
                                alt={t.preview_alt || t.name}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-20 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                              —
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-medium">{t.name}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary">{t.visibility ?? 'public'}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={t.status === 'published' ? 'default' : 'outline'}>
                            {t.status ?? 'draft'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{t.created_by_name ?? '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">
                          {t.updated_at
                            ? new Date(t.updated_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-3">
                          <Link href={`/host/templates/${t.id}/edit`}>
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
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

        <div className="mt-6 border rounded-lg bg-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Greeting Card Samples</h2>
            <p className="text-sm text-gray-500 mt-0.5">Upload card backgrounds with placeholder text for hosts to use in the card designer.</p>
          </div>
          <Link href="/host/templates/greeting-cards">
            <Button variant="outline">Manage samples</Button>
          </Link>
        </div>

        <div className="mt-4">
          <Link href="/host/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
