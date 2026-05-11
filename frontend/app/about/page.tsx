'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { BRAND_NAME } from '@/lib/brand_utility'

const SERIF = "'Cormorant Garamond', Georgia, serif"

const C = {
  dark:    '#0B3D2E',
  parch:   '#E8D8C3',
  gold:    '#D4A017',
  earth:   '#8B5E3C',
  teal:    '#218085',
} as const

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
}

export default function AboutPage() {
  const [mounted, setMounted] = useState(false)
  const valuesRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const els = valuesRef.current.filter(Boolean) as HTMLDivElement[]
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('card-visible') }),
      { threshold: 0.15 }
    )
    els.forEach(e => observer.observe(e))
    return () => els.forEach(e => observer.unobserve(e))
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.parch, cursor: `url('/cursor-fern.svg') 2 21, auto` }}>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(232,216,195,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid rgba(139,94,60,0.12)`,
        }}
      >
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
          className="relative min-h-[72vh] flex items-center px-6 py-24 overflow-hidden"
          style={{ background: C.dark }}
        >
          {/* Decorative radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 60% 55% at 30% 55%, rgba(33,128,133,0.12) 0%, transparent 70%)',
            }}
          />

          {/* Decorative quote mark */}
          <div
            className="absolute right-10 top-12 pointer-events-none select-none"
            style={{
              fontFamily: SERIF,
              fontSize: 'clamp(8rem, 18vw, 16rem)',
              color: 'rgba(212,160,23,0.06)',
              lineHeight: 1,
            }}
          >
            &ldquo;
          </div>

          <div className="max-w-4xl mx-auto w-full relative z-10">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xs uppercase tracking-[0.22em] font-medium mb-6"
              style={{ color: C.gold, opacity: 0.85 }}
            >
              Our story
            </motion.p>

            <motion.h1
              variants={stagger}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
              className="font-light leading-[1.1] mb-8"
              style={{ fontFamily: SERIF, color: C.parch, fontSize: 'clamp(2.8rem, 5.5vw, 5rem)' }}
            >
              {['Never', 'meant', 'to', 'be', 'just', 'another', 'invite', 'platform.'].map((word) => (
                <motion.span key={word} variants={fadeUp} className="inline-block mr-[0.22em]">
                  {word === 'just' ? <em style={{ fontStyle: 'italic' }}>{word}</em> : word}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-lg md:text-xl leading-relaxed max-w-xl"
              style={{ color: '#a8c4b0' }}
              suppressHydrationWarning
            >
              It started with us and a wedding that made us ask: why is hosting people so complicated?
            </motion.p>
          </div>
        </section>

        {/* ── Founders ───────────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.parch }}>
          <div className="max-w-5xl mx-auto">

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7 }}
              className="text-center mb-20"
            >
              <p className="text-xs uppercase tracking-[0.22em] font-medium mb-4" style={{ color: C.gold }}>
                The people behind Ekfern
              </p>
              <h2
                className="text-4xl md:text-5xl font-light"
                style={{ fontFamily: SERIF, color: C.dark }}
              >
                Built by two people who lived the problem
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

              {/* Alisha */}
              <motion.div
                initial={{ opacity: 0, x: -28 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl p-10"
                style={{ background: 'white', border: `1px solid rgba(139,94,60,0.15)` }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold mb-6"
                  style={{ background: `rgba(11,61,46,0.09)`, color: C.dark, fontFamily: SERIF }}
                >
                  A
                </div>
                <p
                  className="text-2xl font-light mb-2"
                  style={{ fontFamily: SERIF, color: C.dark }}
                >
                  Alisha
                </p>
                <p className="text-xs uppercase tracking-widest mb-5" style={{ color: C.gold }}>
                  The planner, Founder
                </p>
                <p className="leading-relaxed" style={{ color: C.earth }}>
                  The executor, and the person who connects ideas, people, and possibilities into a bigger vision.
                  Alisha sees the full picture every detail, every relationship, every moment that makes an event feel alive.
                </p>
              </motion.div>

              {/* Aakash */}
              <motion.div
                initial={{ opacity: 0, x: 28 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl p-10"
                style={{ background: 'white', border: `1px solid rgba(139,94,60,0.15)` }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold mb-6"
                  style={{ background: `rgba(212,160,23,0.10)`, color: C.dark, fontFamily: SERIF }}
                >
                  A
                </div>
                <p
                  className="text-2xl font-light mb-2"
                  style={{ fontFamily: SERIF, color: C.dark }}
                >
                  Aakash
                </p>
                <p className="text-xs uppercase tracking-widest mb-5" style={{ color: C.gold }}>
                  The techie, Co-founder
                </p>
                <p className="leading-relaxed" style={{ color: C.earth }}>
                  The systems thinker, the nerd who loves simplifying chaos.
                  Aakash finds the patterns underneath complexity and turns them into tools that just work quietly, reliably, elegantly.
                </p>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── Origin Story ───────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.dark }}>
          <div className="max-w-3xl mx-auto">

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6 }}
              className="text-xs uppercase tracking-[0.22em] font-medium mb-6 text-center"
              style={{ color: C.gold, opacity: 0.8 }}
            >
              Where it began
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl md:text-5xl font-light text-center mb-14"
              style={{ fontFamily: SERIF, color: C.parch }}
            >
              Our own wedding taught us everything
            </motion.h2>

            {/* Story paragraphs staggered reveal */}
            <div className="space-y-8">
              {[
                'While planning our own wedding, we found ourselves juggling invite designs, guest lists, RSVPs, reminders, spreadsheets, and endless messages across multiple apps.',
                'And somewhere in that chaos, we kept asking ourselves a simple question:',
                'Why is hosting people so complicated?',
                'Creating an invite should feel exciting. Inviting people should feel joyful. Managing guests shouldn\'t feel overwhelming.',
                'So we decided to build something better. Something simple. Something smart. Something sustainable.',
              ].map((para, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.65, delay: i * 0.08 }}
                  className={`leading-relaxed ${
                    i === 2
                      ? 'text-2xl md:text-3xl font-light text-center italic'
                      : 'text-base md:text-lg'
                  }`}
                  style={{
                    fontFamily: i === 2 ? SERIF : undefined,
                    color: i === 2 ? C.gold : '#a8c4b0',
                  }}
                >
                  {para}
                </motion.p>
              ))}
            </div>

            {/* Decorative divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="my-14 origin-left"
              style={{ height: 1, background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }}
            />

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7 }}
              className="text-base md:text-lg leading-relaxed text-center"
              style={{ color: '#a8c4b0' }}
            >
              That&rsquo;s how {BRAND_NAME} was born. Not just as an invite tool, but as a complete platform for hosting
              experiences where invites, RSVPs, reminders, communication, and guest management come together in one seamless flow.
            </motion.p>
          </div>
        </section>

        {/* ── For Everyone ───────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.parch }}>
          <div className="max-w-5xl mx-auto">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16"
            >
              <p className="text-xs uppercase tracking-[0.22em] font-medium mb-4" style={{ color: C.gold }}>
                Built for everyone
              </p>
              <h2
                className="text-4xl md:text-5xl font-light mb-6"
                style={{ fontFamily: SERIF, color: C.dark }}
              >
                Every gathering deserves this
              </h2>
              <p className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: C.earth }}>
                Whether it&rsquo;s a workshop, retreat, wedding, yoga session, community gathering, or celebration
                we believe organizing people should feel lighter, smoother, and more human.
              </p>
            </motion.div>

          </div>
        </section>

        {/* ── Values ─────────────────────────────────────────────── */}
        <section className="py-28 px-6" style={{ background: C.dark }}>
          <div className="max-w-5xl mx-auto">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16"
            >
              <p className="text-xs uppercase tracking-[0.22em] font-medium mb-4" style={{ color: C.gold, opacity: 0.8 }}>
                Our values
              </p>
              <h2
                className="text-4xl md:text-5xl font-light"
                style={{ fontFamily: SERIF, color: C.parch }}
              >
                At our core
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  number: '01',
                  title: 'Simple',
                  body: 'Every feature is designed to remove steps, not add them. If something feels complicated, we haven\'t finished building it.',
                },
                {
                  number: '02',
                  title: 'Smart',
                  body: 'Technology should anticipate your needs. From real-time RSVPs to automated reminders, Ekfern thinks ahead so you don\'t have to.',
                },
                {
                  number: '03',
                  title: 'Sustainable',
                  body: 'Every digital invite is paper not printed. Every managed guest list is a spreadsheet not sent. Beautiful celebrations shouldn\'t cost the earth.',
                },
              ].map((v, i) => (
                <div
                  key={v.title}
                  ref={el => { valuesRef.current[i] = el }}
                  className="rounded-3xl p-10 opacity-0 translate-y-8 transition-all duration-700 card-anim"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid rgba(212,160,23,0.14)`,
                    transitionDelay: `${i * 120}ms`,
                  }}
                >
                  <span
                    className="block text-6xl font-light mb-6 leading-none"
                    style={{ fontFamily: SERIF, color: C.gold, opacity: 0.5 }}
                  >
                    {v.number}
                  </span>
                  <h3
                    className="text-3xl font-light mb-4"
                    style={{ fontFamily: SERIF, color: C.parch }}
                  >
                    {v.title}
                  </h3>
                  <p className="leading-relaxed text-sm" style={{ color: '#a8c4b0' }}>
                    {v.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="py-28 px-6 text-center" style={{ background: C.parch }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.22em] font-medium mb-6" style={{ color: C.gold }}>
              Join us
            </p>
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-light mb-6 mx-auto max-w-2xl leading-[1.15]"
              style={{ fontFamily: SERIF, color: C.dark }}
            >
              Beautiful experiences deserve smoother planning
            </h2>
            <p className="text-base md:text-lg mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: C.earth }}>
              What began as a solution for our own wedding has grown into a platform built for creators, organizers, communities, and hosts everywhere.
            </p>
            <Link href="/host/signup">
              <Button
                className="text-white px-10 py-6 text-base font-medium rounded-full transition-all duration-200 hover:scale-[0.97]"
                style={{ background: C.dark }}
              >
                Start hosting for free →
              </Button>
            </Link>
            <p className="mt-6 text-xs" style={{ color: `rgba(139,94,60,0.55)` }}>
              No credit card required &nbsp;·&nbsp; Free for every celebration
            </p>
          </motion.div>
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
        .card-visible {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      `}</style>
    </div>
  )
}
