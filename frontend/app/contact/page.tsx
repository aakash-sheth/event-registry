import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import { BRAND_NAME } from '@/lib/brand_utility'
import { Mail, Globe, MessageCircle, Phone, MapPin } from 'lucide-react'

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

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold text-bright-teal mb-4">
            Contact Us
          </h1>
          <p className="text-lg text-earth-brown mb-8 leading-relaxed">
            We&apos;d love to hear from you! Whether you have questions, feedback, or need assistance, our team is here to help.
          </p>

          {/* Contact Information Box */}
          <div className="bg-gradient-to-br from-pastel-cream via-pastel-blue to-pastel-cream p-8 rounded-lg mb-8 border border-pastel-green">
            <div className="flex items-start mb-6">
              <MessageCircle className="w-8 h-8 text-bright-teal mr-4 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-bright-teal mb-4">
                  How Can We Help?
                </h2>
                <p className="text-earth-brown mb-4 leading-relaxed">
                  Our support team is available to assist you with:
                </p>
                <ul className="list-disc pl-6 text-earth-brown space-y-2 mb-6">
                  <li>Technical support and troubleshooting</li>
                  <li>Account and billing questions</li>
                  <li>Feature requests and feedback</li>
                  <li>Event planning assistance</li>
                  <li>Privacy and data protection inquiries</li>
                </ul>
                <p className="text-earth-brown font-semibold">
                  We typically respond within 24-48 hours.
                </p>
              </div>
            </div>
          </div>

          {/* Direct Contact Card */}
          <div className="bg-white border-l-4 border-l-bright-teal shadow-md p-8 rounded-lg">
            <h3 className="text-xl font-bold text-bright-teal mb-4">Get in Touch</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <Mail className="w-5 h-5 text-bright-teal mr-3" />
                <div>
                  <p className="text-sm text-earth-brown">Email</p>
                  <a 
                    href="mailto:support@ekfern.com" 
                    className="text-bright-teal hover:text-forest-green font-semibold hover:underline"
                  >
                    support@ekfern.com
                  </a>
                </div>
              </div>
              <div className="flex items-center">
                <Phone className="w-5 h-5 text-bright-teal mr-3" />
                <div>
                  <p className="text-sm text-earth-brown">Phone</p>
                  <a 
                    href="tel:+918275045199" 
                    className="text-bright-teal hover:text-forest-green font-semibold hover:underline"
                  >
                    +91 8275045199
                  </a>
                </div>
              </div>
              <div className="flex items-center">
                <MapPin className="w-5 h-5 text-bright-teal mr-3" />
                <div>
                  <p className="text-sm text-earth-brown">Address</p>
                  <p className="text-bright-teal font-semibold">
                    EkFern · Mumbai, India
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <Globe className="w-5 h-5 text-bright-teal mr-3" />
                <div>
                  <p className="text-sm text-earth-brown">Website</p>
                  <a 
                    href="https://ekfern.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-bright-teal hover:text-forest-green font-semibold hover:underline"
                  >
                    https://ekfern.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-pastel-green flex gap-4">
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
