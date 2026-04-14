'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Mail, CheckCircle, Gift } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { BRAND_NAME } from '@/lib/brand_utility'
import dynamic from 'next/dynamic'
import type { Tile } from '@/lib/invite/schema'

const TilePreview  = dynamic(() => import('@/components/invite/tiles/TilePreview'),  { ssr: false })
const HeroCanvas   = dynamic(() => import('@/components/HeroCanvas'),                { ssr: false })

const SERIF = "'Cormorant Garamond', Georgia, serif"

// ── Brand palette ────────────────────────────────────────────────
const C = {
  dark:    '#0B3D2E',   // bottle green  — dark sections, hero, CTA, footer
  parch:   '#E8D8C3',   // warm parchment — light sections background
  gold:    '#D4A017',   // deep gold     — accents, decorative lines
  earth:   '#8B5E3C',   // earth brown   — body text, subtle details
  teal:    '#218085',   // brand teal    — interactive elements only
  darkMid: '#0f3326',   // bridge mid    — gradient transitions
  darkEdge:'#1a4d38',   // bridge edge   — gradient transitions
} as const

// Hardcoded decorative invite tile — no API call
const HERO_TITLE_TILE: Tile = {
  id: 'hero-title',
  type: 'title',
  enabled: true,
  order: 0,
  settings: {
    text: 'Priya & Arjun',
    font: 'Cormorant Garamond',
    color: '#2D5F3F',
    size: 'large',
    subtitle: 'invite you to celebrate their wedding',
    subtitleSize: 'small',
  },
}

// Template thumbnails — 3 images repeated for seamless marquee loop
const MARQUEE_ROW_1 = Array(7).fill([
  '/invite-templates/classic.svg',
  '/invite-templates/emerald.svg',
  '/invite-templates/minimal.svg',
]).flat()

const MARQUEE_ROW_2 = Array(7).fill([
  '/invite-templates/emerald.svg',
  '/invite-templates/minimal.svg',
  '/invite-templates/classic.svg',
]).flat()

// Framer Motion variants for staggered headline reveal
const heroContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}
const heroWord = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

export default function LandingPage() {
  const stepsRef = useRef<(HTMLDivElement | null)[]>([])
  const heroRef = useRef(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const steps = stepsRef.current.filter(Boolean) as HTMLDivElement[]
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('step-visible') }),
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' }
    )
    steps.forEach(s => observer.observe(s))
    return () => steps.forEach(s => observer.unobserve(s))
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden scroll-smooth" style={{ background: C.parch, cursor: `url('/cursor-fern.svg') 2 21, auto` }}>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50" style={{ background: 'rgba(232,216,195,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid rgba(139,94,60,0.12)` }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <Logo href="/" iconClassName="text-bright-teal" textClassName="text-bright-teal" />
          <div className="flex gap-3 items-center">
            <Link href="/contact" className="text-sm font-medium transition-colors duration-200 hidden sm:block" style={{ color: C.earth }}>
              Contact
            </Link>
            <Link href="/host/login">
              <Button variant="ghost" className="text-sm" style={{ color: C.earth }}>Host Login</Button>
            </Link>
            <Link href="/host/signup">
              <Button className="text-white text-sm px-5 rounded-full transition-all duration-200 hover:scale-[0.98]" style={{ background: C.dark }}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative min-h-[92vh] flex items-center overflow-hidden px-6 py-20"
          style={{ background: C.dark }}  /* fallback if WebGL unavailable */
          suppressHydrationWarning
        >
          {/* WebGL displacement shader — full-section background */}
          <HeroCanvas />

          {/* Ghost invite card — sits above canvas, below content */}
          <div
            className="absolute right-[-8%] top-[50%] pointer-events-none overflow-hidden rounded-[2.5rem]"
            style={{
              width: 'min(54%, 560px)',
              transform: 'translateY(-50%) rotate(4deg)',
              opacity: 0.06,
              zIndex: 1,
              boxShadow: '0 60px 120px rgba(0,0,0,0.6)',
            }}
          >
            <div className="animate-ken-burns-slow origin-center" style={{ background: C.parch, padding: '3rem 2.5rem' }}>
              <p style={{ fontFamily: SERIF, fontSize: 'clamp(2rem,5vw,3.5rem)', color: C.dark, textAlign: 'center', marginBottom: '0.5rem', fontWeight: 300 }}>
                Priya &amp; Arjun
              </p>
              <p style={{ fontFamily: SERIF, fontSize: '1rem', color: C.earth, textAlign: 'center', fontStyle: 'italic', marginBottom: '2rem' }}>
                invite you to celebrate their wedding
              </p>
              <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`, marginBottom: '2rem' }} />
              <div style={{ textAlign: 'center', color: C.earth, fontSize: '0.85rem', lineHeight: 2 }}>
                <p style={{ color: C.dark, fontWeight: 500 }}>Saturday, November 15, 2025</p>
                <p>6:00 PM onwards</p>
                <p>The Grand Ballroom, Mumbai</p>
              </div>
              <div style={{ marginTop: '2rem', background: C.dark, color: 'white', textAlign: 'center', borderRadius: 999, padding: '0.75rem', fontSize: '0.85rem' }}>
                RSVP Now
              </div>
            </div>
          </div>

          {/* Radial glow overlay — softens WebGL into content area */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2,
            background: 'radial-gradient(ellipse 55% 60% at 65% 50%, rgba(33,128,133,0.08) 0%, transparent 65%)' }} />

          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative" style={{ zIndex: 10 }}>

            {/* Left: staggered copy reveal */}
            <div className="flex flex-col items-start">
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-xs uppercase tracking-[0.22em] font-medium mb-6"
                style={{ color: C.gold, opacity: 0.85 }}
              >
                Invitations · RSVP · Gift Registry
              </motion.p>

              {/* Headline — word-by-word stagger */}
              <motion.h1
                variants={heroContainer}
                initial="hidden"
                animate={mounted ? 'visible' : 'hidden'}
                className="font-light leading-[1.08] mb-6 overflow-hidden"
                style={{ fontFamily: SERIF, color: C.parch, fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}
                aria-label="Celebrate with intention"
              >
                {['Celebrate', 'with', 'intention'].map((word) => (
                  <motion.span key={word} variants={heroWord} className="inline-block mr-[0.25em]">
                    {word === 'intention' ? <em>{word}</em> : word}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.65 }}
                className="text-base md:text-lg leading-relaxed mb-10 max-w-md"
                style={{ color: '#a8c4b0' }}
              >
                Beautiful digital invitations, effortless RSVP tracking, and a gift registry that eliminates waste — all in one place.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.85 }}
                className="flex gap-4 flex-wrap mb-8"
              >
                <Link href="/host/signup">
                  <Button className="bg-bright-teal hover:bg-[#1a6870] text-white px-8 py-6 text-base font-medium rounded-full shadow-lg transition-all duration-200 hover:scale-[0.97]">
                    Start for free →
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button
                    variant="outline"
                    className="border border-white/20 text-white/80 hover:bg-white/10 hover:text-white px-8 py-6 text-base font-medium rounded-full transition-all duration-200"
                    style={{ background: 'transparent' }}
                  >
                    See how it works
                  </Button>
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={mounted ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 1.1 }}
                className="text-xs"
                style={{ color: '#6a9e7f' }}
              >
                No credit card required &nbsp;·&nbsp; Free for every celebration
              </motion.p>
            </div>

            {/* Right: floating phone mockup */}
            <div className="flex justify-center items-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  animate={{ y: [0, -14, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                  className="w-[260px] sm:w-[300px]"
                >
                  <div
                    className="rounded-[2.5rem] overflow-hidden"
                    style={{
                      border: '3px solid rgba(255,255,255,0.12)',
                      boxShadow: '0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="h-5 flex justify-center items-center" style={{ background: '#071a11' }}>
                      <div className="w-16 h-2.5 rounded-full" style={{ background: '#050f0a' }} />
                    </div>
                    <div className="flex flex-col" style={{ background: C.parch, minHeight: 460 }}>
                      <TilePreview tile={HERO_TITLE_TILE} />
                      <div className="px-5 pb-6 flex flex-col items-center gap-3">
                        <div className="w-full flex items-center gap-2">
                          <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }} />
                          <span className="text-xs" style={{ color: C.gold }}>❦</span>
                          <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }} />
                        </div>
                        <div className="text-center space-y-1.5 text-xs" style={{ color: C.earth }}>
                          <p className="font-medium text-sm" style={{ color: C.dark }}>November 15, 2025</p>
                          <p>6:00 PM onwards</p>
                          <p style={{ opacity: 0.65 }}>The Grand Ballroom, Mumbai</p>
                        </div>
                        <div className="mt-3 w-full">
                          <div className="text-white text-center py-2.5 rounded-full text-xs font-medium" style={{ background: C.dark }}>
                            RSVP Now
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Template Marquee ───────────────────────────────────── */}
        {/* Bottom half fades toward cream — bridges dark hero into light section */}
        <section className="py-14 overflow-hidden" style={{ background: C.dark, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-center text-xs uppercase tracking-[0.25em] font-medium mb-8" style={{ color: C.gold, opacity: 0.7 }}>
            Designs made to impress
          </p>
          {/* Row 1 — scrolls left, Ken Burns on each card */}
          <div className="group flex mb-3">
            <div className="flex animate-scroll group-hover:[animation-play-state:paused] whitespace-nowrap">
              {[...MARQUEE_ROW_1, ...MARQUEE_ROW_1].map((src, i) => (
                <div
                  key={i}
                  className="inline-block mx-2.5 rounded-2xl overflow-hidden flex-shrink-0 align-top"
                  style={{ height: 176, width: 'auto', boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}
                >
                  <img
                    src={src}
                    alt="Invite template"
                    className="animate-ken-burns origin-center"
                    style={{
                      height: 176,
                      width: 'auto',
                      display: 'block',
                      animationDelay: `${(i * 2.3) % 18}s`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Row 2 — scrolls right, Ken Burns on each card */}
          <div className="group flex">
            <div className="flex animate-scroll-reverse group-hover:[animation-play-state:paused] whitespace-nowrap">
              {[...MARQUEE_ROW_2, ...MARQUEE_ROW_2].map((src, i) => (
                <div
                  key={i}
                  className="inline-block mx-2.5 rounded-2xl overflow-hidden flex-shrink-0 align-top"
                  style={{ height: 176, width: 'auto', boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}
                >
                  <img
                    src={src}
                    alt="Invite template"
                    className="animate-ken-burns origin-center"
                    style={{
                      height: 176,
                      width: 'auto',
                      display: 'block',
                      animationDelay: `${(i * 3.1) % 18}s`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────────── */}
        {/* Top fades from the dark marquee bottom into cream — no hard edge */}
        <section id="how-it-works" className="py-16 px-6" style={{ background: C.parch }}>
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.2em] font-medium mb-3" style={{ color: C.gold }}>
              How it works
            </p>
            <h2
              className="text-center text-4xl md:text-5xl lg:text-6xl font-light mb-14"
              style={{ fontFamily: SERIF, color: C.dark }}
            >
              Three steps to a perfect celebration
            </h2>

            <div className="space-y-12">
              {[
                {
                  number: '01',
                  title: 'Design your invitation',
                  description: 'Choose from beautiful templates and personalise every detail in minutes — no design skills needed. Send via WhatsApp, email, or a shareable link.',
                  visual: (
                    <div className="rounded-3xl p-7 shadow-sm border" style={{ background: 'white', borderColor: `rgba(139,94,60,0.15)` }}>
                      <p className="text-2xl font-light text-center mb-1" style={{ fontFamily: SERIF, color: C.dark }}>Priya &amp; Arjun</p>
                      <p className="text-xs text-center italic mb-5" style={{ color: C.earth }}>invite you to celebrate their wedding</p>
                      <div className="h-px mb-4" style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }} />
                      <div className="text-center space-y-1 text-xs" style={{ color: C.earth }}>
                        <p className="font-medium" style={{ color: C.dark }}>November 15, 2025 · 6:00 PM</p>
                        <p>The Grand Ballroom, Mumbai</p>
                      </div>
                      <div className="mt-5 text-center py-2 rounded-full text-xs font-medium text-white" style={{ background: C.dark }}>
                        RSVP Now
                      </div>
                    </div>
                  ),
                },
                {
                  number: '02',
                  title: 'Track RSVPs in real time',
                  description: 'Guests respond with one tap. You see attendance, meal preferences, and guest counts update live — so you can order exactly what\'s needed.',
                  visual: (
                    <div className="rounded-3xl p-7 shadow-sm border" style={{ background: 'white', borderColor: `rgba(139,94,60,0.15)` }}>
                      <p className="text-xs font-semibold mb-5" style={{ color: C.gold }}>Guest Responses</p>
                      {[
                        { initials: 'RS', name: 'Rohan Sharma', status: 'Attending', bg: `rgba(11,61,46,0.08)` },
                        { initials: 'PK', name: 'Priya Kapoor', status: 'Attending', bg: `rgba(212,160,23,0.10)` },
                        { initials: 'AM', name: 'Amit Mehta',   status: 'Maybe',     bg: `rgba(139,94,60,0.10)` },
                      ].map((g, i) => (
                        <div key={i} className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: g.bg, color: C.dark }}>{g.initials}</div>
                          <span className="text-sm flex-1" style={{ color: C.earth }}>{g.name}</span>
                          <span className="text-xs font-medium" style={{ color: C.gold }}>{g.status} ✓</span>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  number: '03',
                  title: 'See your impact',
                  description: 'Every celebration on Ekfern generates a real sustainability report — paper saved, food waste prevented, and gifts managed without duplication.',
                  visual: (
                    <div className="rounded-3xl p-7 shadow-sm border" style={{ background: 'white', borderColor: `rgba(139,94,60,0.15)` }}>
                      <p className="text-xs font-semibold mb-5" style={{ color: C.gold }}>Your celebration impact</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { stat: '500+', label: 'Sheets of paper saved' },
                          { stat: '40%', label: 'Less food waste' },
                          { stat: '0', label: 'Duplicate gifts' },
                          { stat: '127', label: 'RSVPs tracked' },
                        ].map((m, i) => (
                          <div key={i} className="rounded-2xl p-4 text-center" style={{ background: C.parch, border: `1px solid rgba(139,94,60,0.1)` }}>
                            <div className="text-2xl font-semibold mb-1" style={{ color: C.dark, fontFamily: SERIF }}>{m.stat}</div>
                            <div className="text-xs" style={{ color: C.earth }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  ref={el => { stepsRef.current[idx] = el }}
                  className={`flex flex-col ${idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 opacity-0 transition-all duration-700 ${idx % 2 === 1 ? 'translate-x-8' : '-translate-x-8'}`}
                >
                  <div className="flex-1 space-y-4">
                    <span className="text-base font-light" style={{ color: C.gold, fontFamily: SERIF }}>{step.number}</span>
                    <h3 className="text-4xl md:text-5xl font-light" style={{ fontFamily: SERIF, color: C.dark }}>
                      {step.title}
                    </h3>
                    <p className="text-lg leading-relaxed max-w-md" style={{ color: C.earth }}>{step.description}</p>
                  </div>
                  <div className="flex-1 w-full max-w-md">{step.visual}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        {/* Same cream as How It Works — reads as one continuous light zone */}
        <section className="py-28 px-6" style={{ background: C.parch }}>
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.2em] font-medium mb-4" style={{ color: C.gold }}>
              Everything included
            </p>
            <h2
              className="text-center text-4xl md:text-5xl font-light mb-20"
              style={{ fontFamily: SERIF, color: C.dark }}
            >
              One platform for every celebration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                {
                  icon: Mail,
                  title: 'Digital Invitations',
                  desc: 'Stunning, personalised invite pages with custom themes, RSVP forms, and one-tap sharing via WhatsApp or link.',
                },
                {
                  icon: CheckCircle,
                  title: 'Smart RSVP Tracking',
                  desc: 'Real-time response tracking with meal preferences and guest counts. No spreadsheets, no chasing people.',
                },
                {
                  icon: Gift,
                  title: 'Gift Registry',
                  desc: 'A curated registry guests can actually use — no duplicates, no returns, no landfill.',
                },
              ].map((f, idx) => (
                <div
                  key={idx}
                  className="group p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1"
                  style={{ border: `1px solid rgba(139,94,60,0.18)`, background: 'white' }}
                >
                  <f.icon className="w-8 h-8 mb-6 transition-colors duration-200" style={{ color: C.gold }} />
                  <h3 className="text-xl font-light mb-3" style={{ fontFamily: SERIF, color: C.dark }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.earth }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        {/* Top fades parch → dark — mirrors marquee transition inverted */}
        <section className="py-28 px-6 text-center" style={{ background: C.dark }}>
          <p className="text-xs uppercase tracking-[0.2em] font-medium mb-6" style={{ color: C.gold, opacity: 0.8 }}>
            Get started today
          </p>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-light mb-8 mx-auto max-w-2xl leading-[1.15]"
            style={{ fontFamily: SERIF, color: C.parch }}
          >
            Your celebration deserves more than a WhatsApp forward
          </h2>
          <Link href="/host/signup">
            <Button className="px-10 py-6 text-base font-medium rounded-full transition-all duration-200 hover:scale-[0.97]" style={{ background: C.gold, color: C.dark }}>
              Create your free invitation →
            </Button>
          </Link>
          <p className="mt-6 text-xs" style={{ color: '#6a9e7f' }}>
            No credit card required · Free forever for small celebrations
          </p>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-10 px-6" style={{ background: C.dark, borderTop: `1px solid rgba(212,160,23,0.12)` }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm font-medium" style={{ color: C.gold, fontFamily: SERIF, opacity: 0.8 }}>{BRAND_NAME}</p>
          <div className="flex gap-6 items-center">
            <Link href="/privacy" className="text-xs transition-opacity duration-200 hover:opacity-100" style={{ color: C.gold, opacity: 0.45 }}>
              Privacy Policy
            </Link>
            <Link href="/contact" className="text-xs transition-opacity duration-200 hover:opacity-100" style={{ color: C.gold, opacity: 0.45 }}>
              Contact
            </Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .step-visible {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }
      `}</style>
    </div>
  )
}
