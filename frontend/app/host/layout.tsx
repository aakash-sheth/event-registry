import type { Metadata } from 'next'
import HostShell from '@/components/host/HostShell'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  },
}

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>
}

