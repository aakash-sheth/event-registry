import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import { BRAND_NAME } from '@/lib/brand_utility'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `Privacy Policy for ${BRAND_NAME} - Learn how we collect, use, and protect your personal information.`,
}

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-earth-brown mb-8 text-sm">
            Last updated: January 18, 2026
          </p>

          <div className="prose prose-lg max-w-none text-earth-brown">
            <p className="text-lg mb-8 leading-relaxed">
              {BRAND_NAME} (&quot;{BRAND_NAME}&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, store, and protect your information when you use the {BRAND_NAME} platform and related services.
            </p>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                1. Information We Collect
              </h2>
              <p className="mb-4">
                We collect information only when it is necessary to provide our services.
              </p>
              
              <h3 className="text-xl font-semibold text-bright-teal mb-3 mt-6">
                a. Information You Provide
              </h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number (including WhatsApp number)</li>
                <li>Event-related information (such as RSVP responses, guest preferences, or messages you submit)</li>
                <li>Gift registry information (if applicable)</li>
              </ul>

              <h3 className="text-xl font-semibold text-bright-teal mb-3 mt-6">
                b. Information Collected Automatically
              </h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Device and browser information</li>
                <li>IP address</li>
                <li>Usage data such as page visits and interaction timestamps</li>
                <li>Message delivery and engagement status (e.g., sent, delivered, opened)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                2. How We Use Your Information
              </h2>
              <p className="mb-4">
                We use your information strictly to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Create and manage event invite pages</li>
                <li>Collect and manage RSVPs</li>
                <li>Send event-related messages, confirmations, reminders, and updates</li>
                <li>Facilitate guest communication for a specific event</li>
                <li>Improve platform reliability, performance, and user experience</li>
                <li>Comply with legal and regulatory requirements</li>
              </ul>
              <p className="mt-4 font-semibold text-forest-green">
                {BRAND_NAME} does not sell or rent personal data to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                3. WhatsApp Communication
              </h2>
              <p className="mb-4">
                {BRAND_NAME} uses the WhatsApp Cloud API by Meta to send event-related messages.
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Messages are sent only to users who are invited to an event or have explicitly opted in</li>
                <li>Communication is limited to invitations, confirmations, reminders, schedule updates, and important event announcements</li>
                <li>{BRAND_NAME} does not send promotional, marketing, or unsolicited messages via WhatsApp</li>
                <li>Users may opt out of WhatsApp communication at any time by following the opt-out instructions included in messages.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                4. Data Sharing and Third Parties
              </h2>
              <p className="mb-4">
                We may share limited data with trusted third-party service providers solely to operate our services, including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Cloud hosting providers</li>
                <li>Analytics and monitoring tools</li>
                <li>Messaging services (such as Meta&apos;s WhatsApp Cloud API)</li>
              </ul>
              <p className="mt-4">
                These providers are contractually required to protect your data and use it only for the intended purpose.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                5. Data Retention
              </h2>
              <p className="mb-4">
                We retain personal information only for as long as necessary to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide event-related services</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes or enforce agreements</li>
              </ul>
              <p className="mt-4">
                Event data may be deleted or anonymized after the event concludes, subject to system and legal requirements.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                6. Data Security
              </h2>
              <p className="mb-4">
                We implement reasonable technical and organizational safeguards to protect your information against unauthorized access, alteration, disclosure, or destruction.
              </p>
              <p className="mt-4">
                However, no method of transmission over the internet or electronic storage is 100% secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                7. Your Rights
              </h2>
              <p className="mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your data</li>
                <li>Withdraw consent for communication</li>
              </ul>
              <p className="mt-4">
                Requests can be made by contacting us at the email address below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                8. Children&apos;s Privacy
              </h2>
              <p className="mb-4">
                {BRAND_NAME} is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                9. Changes to This Privacy Policy
              </h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. Updates will be posted on this page with a revised &quot;Last updated&quot; date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-forest-green mb-4 mt-8">
                10. Contact Us
              </h2>
              <p className="mb-4">
                If you have any questions or concerns about this Privacy Policy or our data practices, you may contact us at:
              </p>
              <div className="bg-pastel-cream p-6 rounded-lg mt-4">
                <p className="mb-2">
                  <strong className="text-forest-green">Email:</strong>{' '}
                  <a 
                    href="mailto:support@ekfern.com" 
                    className="text-bright-teal hover:underline"
                  >
                    support@ekfern.com
                  </a>
                </p>
                <p>
                  <strong className="text-forest-green">Website:</strong>{' '}
                  <a 
                    href="https://ekfern.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-bright-teal hover:underline"
                  >
                    https://ekfern.com
                  </a>
                </p>
              </div>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-pastel-green">
            <Link href="/">
              <Button variant="outline" className="border-2 border-bright-teal text-bright-teal hover:bg-bright-teal hover:text-white">
                ← Back to Home
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
