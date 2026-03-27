'use client'

import React from 'react'
import { BRAND_NAME, COMPANY_HOMEPAGE } from '@/lib/brand_utility'

export default function PoweredByBranding() {
  return (
    <div className="w-full py-8 px-4 flex flex-col items-center gap-2">
      <div className="w-12 h-px bg-gray-200" />
      <p className="text-xs text-gray-400 text-center leading-relaxed">
        Create your own free wedding invite on{' '}
        <a
          href={`${COMPANY_HOMEPAGE}?utm_source=invite_footer&utm_medium=referral&utm_campaign=powered_by`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-700 font-medium underline underline-offset-2 transition-colors"
        >
          {BRAND_NAME}
        </a>
      </p>
    </div>
  )
}
