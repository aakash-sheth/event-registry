'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface MeResponse {
  id: number
  email: string
  name: string
  is_staff?: boolean
}

/**
 * Staff-only layout for Page Layout Studio. Regular hosts are redirected to dashboard.
 * All routes under /host/page-layouts/* are protected by this layout.
 */
export default function PageLayoutStudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token) {
      router.replace('/host/login')
      return
    }
    api
      .get<MeResponse>('/api/auth/me/')
      .then((res) => {
        if (res.data?.is_staff !== true) {
          router.replace('/host/dashboard')
          return
        }
        setAllowed(true)
      })
      .catch(() => {
        router.replace('/host/dashboard')
      })
  }, [router])

  if (allowed !== true) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}
