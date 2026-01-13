'use client'

import React from 'react'
import { BRAND_NAME, COMPANY_HOMEPAGE } from '@/lib/brand_utility'

export default function PoweredByBranding() {
  // Ensure we use ekfern.com as the company website link
  const companyUrl = 'https://ekfern.com'
  
  return (
    <div className="w-full py-4 px-4 flex items-center justify-center">
      <p className="text-xs text-gray-400 text-center">
        Powered by{' '}
        <a
          href={companyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-700 underline transition-colors"
        >
          {BRAND_NAME}
        </a>
      </p>
    </div>
  )
}

