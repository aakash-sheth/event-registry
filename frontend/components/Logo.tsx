'use client'

import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand_utility'
import { cn } from '@/lib/utils'

interface LogoProps {
  href?: string
  className?: string
  iconClassName?: string
  textClassName?: string
  showIcon?: boolean
}

export default function Logo({ 
  href = '/', 
  className,
  iconClassName,
  textClassName,
  showIcon = true 
}: LogoProps) {
  const logoContent = (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <Leaf className={cn('w-6 h-6 text-eco-green', iconClassName)} />
      )}
      <span className={cn('text-xl font-bold text-eco-green', textClassName)}>
        {BRAND_NAME}
      </span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center">
        {logoContent}
      </Link>
    )
  }

  return logoContent
}

