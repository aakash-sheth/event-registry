'use client'

import { DEMO } from '@/lib/invite/loadConfig'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'

export default function DemoPage() {
  return (
    <LivingPosterPage
      config={DEMO}
      eventSlug="aakash-alisha"
      eventDate="2025-12-22T18:00:00-05:00"
    />
  )
}

