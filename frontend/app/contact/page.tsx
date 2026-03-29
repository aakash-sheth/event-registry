import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import { BRAND_NAME, SUPPORT_EMAIL } from '@/lib/brand_utility'
import { Mail, Phone, MapPin } from 'lucide-react'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Contact ${BRAND_NAME} - Get in touch with our support team for questions, feedback, or assistance.`,
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-pastel-green sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo
            href="/"
            iconClassName="text-bright-teal"
            textClassName="text-bright-teal"
          />
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

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-bright-teal mb-3">Contact Us</h1>
          <p className="text-lg text-earth-brown">
            We&apos;d love to hear from you. Fill in the form and we&apos;ll get back to you within 24–48 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Left — contact details */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-gradient-to-br from-pastel-cream via-pastel-blue to-pastel-cream rounded-lg p-6 border border-pastel-green">
              <h2 className="text-lg font-bold text-bright-teal mb-5">Get in Touch</h2>
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-bright-teal mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-earth-brown mb-0.5">Email</p>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="text-sm font-semibold text-bright-teal hover:text-forest-green hover:underline"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-bright-teal mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-earth-brown mb-0.5">Phone</p>
                    <a
                      href="tel:+918275045199"
                      className="text-sm font-semibold text-bright-teal hover:text-forest-green hover:underline"
                    >
                      +91 82750 45199
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-bright-teal mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-earth-brown mb-0.5">Location</p>
                    <p className="text-sm font-semibold text-bright-teal">Mumbai, India</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-earth-brown space-y-1.5">
              <p className="font-semibold text-bright-teal mb-2">We can help with:</p>
              <p>· Technical support &amp; troubleshooting</p>
              <p>· Account and billing questions</p>
              <p>· Feature requests and feedback</p>
              <p>· Event planning assistance</p>
              <p>· Invite design help</p>
              <p>· Privacy and data inquiries</p>
            </div>
          </div>

          {/* Right — form */}
          <div className="md:col-span-3 bg-white rounded-lg shadow-md border border-gray-100 p-8">
            <h2 className="text-lg font-bold text-bright-teal mb-6">Send us a message</h2>
            <ContactForm />
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-pastel-green flex gap-4">
          <Link href="/">
            <Button variant="outline" className="border-2 border-bright-teal text-bright-teal hover:bg-bright-teal hover:text-white">
              ← Back to Home
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant="ghost" className="text-bright-teal hover:text-forest-green">
              Privacy Policy
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-forest-green text-white py-8 px-4 text-center mt-12">
        <p className="text-lg font-bold mb-2">🌿 <strong>{BRAND_NAME}</strong></p>
        <p className="text-sm opacity-80 mb-4">Making celebrations smarter, more sustainable, and more meaningful.</p>
        <div className="flex gap-4 justify-center items-center">
          <Link href="/privacy" className="text-sm opacity-80 hover:opacity-100 underline">
            Privacy Policy
          </Link>
          <span className="text-sm opacity-60">•</span>
          <Link href="/contact" className="text-sm opacity-80 hover:opacity-100 underline">
            Contact Us
          </Link>
        </div>
      </footer>
    </div>
  )
}
