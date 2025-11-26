'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Leaf, 
  Mail, 
  CheckCircle, 
  Gift, 
  Calendar, 
  MapPin, 
  FileText, 
  UtensilsCrossed, 
  Clock,
  Check,
  Bell,
  Lock
} from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function LandingPage() {
  const stepsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const steps = stepsRef.current.filter(Boolean) as HTMLDivElement[]
    
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('step-visible')
        }
      })
    }, observerOptions)

    steps.forEach(step => {
      observer.observe(step)
    })

    return () => {
      steps.forEach(step => observer.unobserve(step))
    }
  }, [])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-pastel-green sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-bright-teal" />
            <div>
              <div className="text-xl font-bold text-bright-teal">Celebrate Mindfully</div>
              <div className="text-xs text-gray-500">by Sustain &amp; Slay</div>
            </div>
          </div>
          <div className="flex gap-4">
            <Link href="/host/login">
              <Button variant="ghost" className="text-bright-teal">Host Login</Button>
            </Link>
            <Link href="/host/signup">
              <Button className="bg-bright-teal hover:bg-forest-green text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-pastel-cream via-pastel-blue to-pastel-cream overflow-hidden px-4 py-8">
          {/* Floating background elements */}
          <div className="absolute w-[300px] h-[300px] bg-pastel-green rounded-full -top-[100px] -right-[100px] opacity-30 animate-float" />
          <div className="absolute w-[200px] h-[200px] bg-sunshine-yellow rounded-full -bottom-[50px] -left-[50px] opacity-30 animate-float-reverse" />
          
          <div className="text-center z-10 max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-bright-teal mb-4">
              🌿 Celebrate Mindfully
            </h1>
            <p className="text-xl md:text-2xl text-forest-green mb-4">
              Plan Smarter. Celebrate Sustainably.
            </p>
            <p className="text-base md:text-lg text-earth-brown mb-8 max-w-3xl mx-auto">
              Create beautiful digital invitations, manage RSVPs, and build gift registries—all in one place.<br />
              <strong>Reduce waste, save time, and make every celebration meaningful.</strong>
            </p>
            <div className="flex gap-4 justify-center flex-wrap mb-6">
              <Link href="/host/signup">
                <Button className="bg-bright-teal hover:bg-forest-green text-white px-8 py-6 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                  Start Free Trial →
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" className="border-2 border-bright-teal text-bright-teal hover:bg-bright-teal hover:text-white px-8 py-6 text-lg font-semibold rounded-full">
                  View Live Demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-earth-brown">
              ✓ No credit card required &nbsp;•&nbsp; ✓ Setup in 5 minutes &nbsp;•&nbsp; ✓ Free invites for every celebration
            </p>
          </div>
        </section>

        {/* Moving Impact Banner */}
        <section className="bg-gradient-to-r from-bright-teal via-forest-green to-bright-teal bg-[length:200%_100%] py-12 overflow-hidden animate-gradient-shift">
          <div className="flex animate-scroll whitespace-nowrap">
            {[
              { number: '500+', text: 'Hosts Choosing Intention' },
              { number: '2,500+', text: 'Celebrations Reimagined' },
              { number: '50K+', text: 'RSVPs Tracked' },
              { number: '₹2.5Cr+', text: 'Thoughtful Gifts' },
              { number: '1M+', text: 'Sheets of Paper Saved' },
              { number: '125K kg', text: 'Food Waste Prevented' },
            ].concat([
              { number: '500+', text: 'Hosts Choosing Intention' },
              { number: '2,500+', text: 'Celebrations Reimagined' },
              { number: '50K+', text: 'RSVPs Tracked' },
              { number: '₹2.5Cr+', text: 'Thoughtful Gifts' },
              { number: '1M+', text: 'Sheets of Paper Saved' },
              { number: '125K kg', text: 'Food Waste Prevented' },
            ]).map((item, idx) => (
              <div key={idx} className="inline-flex items-center mx-12 text-white text-xl md:text-2xl font-semibold">
                <span className="text-3xl md:text-4xl mr-2 text-sunshine-yellow">{item.number}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-20 px-4 bg-pastel-cream text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-bright-teal mb-12">
            Yet here you are, drowning in...
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { icon: '📱', title: 'RSVP Chaos', desc: 'Guests responding on different platforms (or not at all)' },
              { icon: '📄', title: 'Paper Waste', desc: '500+ printed invitations for a single event, ending up in trash' },
              { icon: '🎁', title: 'Duplicate Gifts', desc: 'Unwanted gifts piling up, returns, and landfill waste' },
              { icon: '🍽️', title: 'Food Over-ordering', desc: '30-40% of catered food wasted due to inaccurate guest counts' },
            ].map((problem, idx) => (
              <Card key={idx} className="bg-white border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-2">
                <CardContent className="p-6 text-center">
                  <div className="text-5xl mb-4">{problem.icon}</div>
                  <h3 className="text-xl font-semibold text-forest-green mb-3">{problem.title}</h3>
                  <p className="text-gray-700">{problem.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 bg-white">
          <h2 className="text-center text-3xl md:text-4xl lg:text-5xl font-bold text-bright-teal mb-16">
            How It Works – In 3 Simple Steps
          </h2>
          <div className="max-w-6xl mx-auto space-y-16">
            {[
              {
                number: 1,
                title: '💌 Create Your Digital Invitation',
                description: 'Design beautiful, personalized digital invitations in under 5 minutes. Add your event details, enable RSVP tracking, and set up your gift registry. No printing. No postage. Instant delivery.',
                impact: '🌱 Save 500+ sheets of paper per 100 guests',
                visual: '📧',
              },
              {
                number: 2,
                title: '✅ Share & Track RSVPs',
                description: 'Send one simple link via WhatsApp, email, or social media. Guests receive their invite, RSVP instantly, and browse your gift registry—all from any device. Real-time tracking. Zero chaos.',
                impact: '🌱 Prevent 50-100kg of food waste with accurate counts',
                visual: '📊',
              },
              {
                number: 3,
                title: '🎯 See Your Impact in Real-Time',
                description: 'Watch RSVPs, gift bookings, and sustainability metrics update live. Export data anytime. See exactly how much waste you\'ve prevented. Celebrate with purpose.',
                impact: '🌱 Track paper saved, food waste prevented, and positive impact',
                visual: '🎉',
              },
            ].map((step, idx) => (
              <div
                key={idx}
                ref={el => { stepsRef.current[idx] = el }}
                className={`flex flex-col ${idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 opacity-0 transition-all duration-700 ${
                  idx % 2 === 1 ? 'translate-x-12' : '-translate-x-12'
                }`}
              >
                <div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-bright-teal to-pastel-green rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg">
                  {step.number}
                </div>
                <div className="flex-1 bg-pastel-cream p-8 rounded-3xl shadow-lg">
                  <h3 className="text-2xl md:text-3xl font-bold text-bright-teal mb-4">{step.title}</h3>
                  <p className="text-lg text-earth-brown mb-4 leading-relaxed">{step.description}</p>
                  <p className="text-bright-teal font-semibold">{step.impact}</p>
                </div>
                <div className="flex-1 bg-pastel-blue rounded-3xl p-8 min-h-[200px] flex items-center justify-center text-6xl shadow-lg">
                  {step.visual}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-pastel-green via-pastel-blue to-pastel-green">
          <h2 className="text-center text-3xl md:text-4xl lg:text-5xl font-bold text-bright-teal mb-16">
            Everything You Need, All in One Platform
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: Mail, title: 'Digital Invitations', desc: 'Beautiful, personalized invites with no paper waste. Share via link or QR code.' },
              { icon: CheckCircle, title: 'Smart RSVP Tracking', desc: 'Real-time responses with guest counts and meal preferences. Order exactly what you need.' },
              { icon: Gift, title: 'Gift Registry', desc: 'Avoid duplicates, reduce returns. Guests gift what you\'ll actually use.' },
              { icon: Leaf, title: 'Sustainability Dashboard', desc: 'See your environmental impact: paper saved, food waste prevented, gifts managed mindfully.' },
              { icon: Bell, title: 'Smart Notifications', desc: 'Auto-notify hosts and guests when RSVPs change, dress codes update, or gifts are added.' },
              { icon: Lock, title: 'Private Guest Lists', desc: 'Control who can RSVP with private settings. Manage your approved guest list easily.' },
            ].map((feature, idx) => (
              <Card key={idx} className="bg-white border-l-4 border-l-bright-teal shadow-md hover:shadow-xl transition-all hover:scale-105">
                <CardContent className="p-6">
                  <feature.icon className="w-12 h-12 text-bright-teal mb-4" />
                  <h3 className="text-xl font-semibold text-bright-teal mb-3">{feature.title}</h3>
                  <p className="text-gray-700">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Sustainability Impact Section */}
        <section className="py-20 px-4 bg-pastel-cream text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-bright-teal mb-6">
            The Impact We&apos;re Creating Together
          </h2>
          <p className="text-xl text-forest-green mb-12 max-w-3xl mx-auto">
            Every celebration on our platform creates real, measurable environmental impact
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { stat: '40%', label: 'Less Food Waste' },
              { stat: '100%', label: 'Paper Saved' },
              { stat: '10+', label: 'Hours Saved' },
              { stat: '0', label: 'Duplicate Gifts' },
            ].map((impact, idx) => (
              <Card key={idx} className="bg-white p-8 rounded-3xl shadow-md hover:shadow-xl transition-all hover:-translate-y-2 hover:bg-gradient-to-br hover:from-pastel-green hover:to-pastel-blue group">
                <CardContent className="p-0">
                  <div className="text-5xl font-bold text-bright-teal mb-2 group-hover:text-white transition-colors">
                    {impact.stat}
                  </div>
                  <div className="text-lg font-semibold text-forest-green group-hover:text-white transition-colors">
                    {impact.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-bright-teal to-forest-green py-20 px-4 text-center text-white">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Ready to Plan Your Perfect Event?
          </h2>
          <p className="text-xl md:text-2xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join hundreds of hosts who are making their celebrations more meaningful and sustainable.
          </p>
          <Link href="/host/signup">
            <Button className="bg-white text-bright-teal hover:bg-pastel-cream px-10 py-7 text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
              Get Started Free →
            </Button>
          </Link>
          <p className="mt-6 text-sm opacity-90">
            No credit card required • Setup in 5 minutes • Free invites for every celebration
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-forest-green text-white py-8 px-4 text-center">
        <p className="text-lg font-bold mb-2">🌿 <strong>Celebrate Mindfully</strong></p>
        <p className="text-sm opacity-80">Making celebrations smarter, more sustainable, and more meaningful.</p>
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
