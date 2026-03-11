/**
 * WizardProgress — horizontal step indicator for the invitation creation wizard.
 *
 * Steps:
 *   1. Event Details  (/host/events/new)
 *   2. Greeting Card  (/host/events/[eventId]/card)
 *   3. Layout         (/host/events/[eventId]/layout)
 *   4. Design         (/host/events/[eventId]/design)
 *
 * Completed steps are clickable (navigate) when eventId is provided.
 */

import React from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export interface WizardProgressProps {
  currentStep: 1 | 2 | 3 | 4
  /** Required for steps 2–4 nav links and completed-step navigation. */
  eventId?: number
}

interface StepDefinition {
  number: 1 | 2 | 3 | 4
  label: string
  href: (id: number) => string
}

const STEPS: StepDefinition[] = [
  { number: 1, label: 'Event Details', href: () => '/host/events/new' },
  { number: 2, label: 'Greeting Card', href: (id) => `/host/events/${id}/card` },
  { number: 3, label: 'Layout', href: (id) => `/host/events/${id}/layout` },
  { number: 4, label: 'Design', href: (id) => `/host/events/${id}/design` },
]

type StepState = 'completed' | 'active' | 'future'

function stepState(stepNumber: number, currentStep: number): StepState {
  if (stepNumber < currentStep) return 'completed'
  if (stepNumber === currentStep) return 'active'
  return 'future'
}

/** Checkmark icon rendered for completed steps. */
function CheckIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

interface StepCircleProps {
  state: StepState
  number: number
}

function StepCircle({ state, number }: StepCircleProps): React.ReactElement {
  if (state === 'completed') {
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key="check"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="flex items-center justify-center"
          >
            <CheckIcon />
          </motion.span>
        </AnimatePresence>
      </span>
    )
  }
  if (state === 'active') {
    return (
      <motion.span
        className="flex items-center justify-center w-8 h-8 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0 text-sm font-bold"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {number}
      </motion.span>
    )
  }
  // future
  return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-400 ring-2 ring-gray-300 flex-shrink-0 text-sm font-medium">
      {number}
    </span>
  )
}

interface StepNodeProps {
  step: StepDefinition
  state: StepState
  eventId?: number
}

function StepNode({ step, state, eventId }: StepNodeProps): React.ReactElement {
  const isClickable = state === 'completed' && eventId != null && step.number > 1
  const circle = <StepCircle state={state} number={step.number} />

  const labelClasses =
    state === 'active'
      ? 'font-semibold text-eco-green'
      : state === 'completed'
      ? 'font-medium text-gray-500'
      : 'font-medium text-gray-400'

  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      {circle}
      {/* Label: hidden on very small screens, shown sm+ */}
      <span className={`hidden sm:block text-xs leading-tight text-center ${labelClasses}`}>
        {step.label}
      </span>
    </div>
  )

  if (isClickable) {
    return (
      <Link
        href={step.href(eventId!)}
        className="flex flex-col items-center gap-1.5 group focus:outline-none"
        aria-label={`Go to step ${step.number}: ${step.label}`}
      >
        <motion.span
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0"
        >
          <CheckIcon />
        </motion.span>
        <span className={`hidden sm:block text-xs leading-tight text-center ${labelClasses} group-hover:text-eco-green transition-colors`}>
          {step.label}
        </span>
      </Link>
    )
  }

  return inner
}

/** Connector line between two step nodes. */
function Connector({ leftState }: { leftState: StepState }): React.ReactElement {
  return (
    <div
      className={`flex-1 h-0.5 mx-1 ${leftState === 'future' ? 'bg-gray-200' : 'bg-eco-green'}`}
      aria-hidden="true"
    />
  )
}

export default function WizardProgress({
  currentStep,
  eventId,
}: WizardProgressProps): React.ReactElement {
  return (
    <nav
      aria-label="Invitation creation wizard progress"
      className="w-full bg-white border-b border-gray-100 px-4 py-4"
    >
      <div className="max-w-2xl mx-auto">
        <ol className="flex items-center w-full" role="list">
          {STEPS.map((step, index) => {
            const state = stepState(step.number, currentStep)
            const isLast = index === STEPS.length - 1
            return (
              <React.Fragment key={step.number}>
                <li className="flex items-center justify-center">
                  <StepNode step={step} state={state} eventId={eventId} />
                </li>
                {!isLast && <Connector leftState={state} />}
              </React.Fragment>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
