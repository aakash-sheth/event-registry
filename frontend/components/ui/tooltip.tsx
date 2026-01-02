'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

const TooltipProvider = ({ children, delayDuration = 700 }: TooltipProviderProps) => {
  return <>{children}</>
}

interface TooltipProps {
  children: React.ReactNode
}

const Tooltip = ({ children }: TooltipProps) => {
  return <>{children}</>
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
  children: React.ReactNode
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ asChild, children, className, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ref,
        className: cn('group relative', children.props.className),
        ...props,
      } as any)
    }

    return (
      <span
        ref={ref as any}
        className={cn('group relative inline-block', className)}
        {...props}
      >
        {children}
      </span>
    )
  }
)
TooltipTrigger.displayName = 'TooltipTrigger'

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = 'top', sideOffset = 4, children, ...props }, ref) => {
    const sideClasses = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    }

    const arrowClasses = {
      top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-t-0 border-r-0',
      bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-b-0 border-l-0',
      left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-l-0 border-b-0',
      right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-r-0 border-t-0',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'absolute z-50 rounded-md border bg-white px-3 py-1.5 text-sm text-gray-900 shadow-lg',
          'pointer-events-none opacity-0 transition-opacity duration-200',
          'group-hover:opacity-100',
          sideClasses[side],
          className
        )}
        {...props}
      >
        {children}
        <div
          className={cn(
            'absolute w-2 h-2 bg-white border rotate-45',
            arrowClasses[side]
          )}
        />
      </div>
    )
  }
)
TooltipContent.displayName = 'TooltipContent'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
