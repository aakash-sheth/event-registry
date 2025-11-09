'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-eco-beige">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-eco-green-light sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="text-xl font-bold text-eco-green">CelebrateMindfully</span>
          </div>
          <div className="flex gap-4">
            <Link href="/host/login">
              <Button variant="ghost" className="text-eco-green">Host Login</Button>
            </Link>
            <Link href="/host/login">
              <Button className="bg-eco-green hover:bg-green-600 text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-block bg-eco-green-light px-4 py-2 rounded-full mb-6">
            <span className="text-sm font-medium text-eco-green">✨ Trusted by 500+ hosts across India</span>
          </div>
          <h1 className="text-6xl font-bold mb-6 text-eco-green leading-tight">
            Plan Smarter.<br />
            Celebrate Sustainably.
          </h1>
          <p className="text-2xl text-gray-700 mb-8 leading-relaxed">
            The all-in-one platform for RSVPs and gift registries.<br />
            <span className="text-lg text-gray-600">Reduce waste, save time, and make every celebration meaningful.</span>
          </p>
          <div className="flex gap-4 justify-center mb-12">
            <Link href="/host/signup">
              <Button className="bg-eco-green hover:bg-green-600 text-white px-10 py-7 text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
                Start Free Trial →
              </Button>
            </Link>
            <Link href="/registry/demo-wedding">
              <Button variant="outline" className="border-2 border-eco-green text-eco-green hover:bg-eco-green-light px-10 py-7 text-lg rounded-full">
                View Live Demo
              </Button>
            </Link>
          </div>
          
          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Setup in 5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Free forever</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl p-6 text-center border border-eco-green-light shadow-sm">
            <div className="text-3xl font-bold text-eco-green mb-2">500+</div>
            <div className="text-sm text-gray-600">Active Hosts</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border border-eco-green-light shadow-sm">
            <div className="text-3xl font-bold text-eco-green mb-2">2,500+</div>
            <div className="text-sm text-gray-600">Events Created</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border border-eco-green-light shadow-sm">
            <div className="text-3xl font-bold text-eco-green mb-2">50K+</div>
            <div className="text-sm text-gray-600">RSVPs Tracked</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border border-eco-green-light shadow-sm">
            <div className="text-3xl font-bold text-eco-green mb-2">₹2.5Cr+</div>
            <div className="text-sm text-gray-600">Gifts Managed</div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-eco-green">Stop the Guesswork</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Traditional event planning leads to waste, stress, and missed opportunities. 
              We make it simple, accurate, and sustainable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-eco-beige border-2 border-eco-green-light">
              <CardHeader>
                <div className="text-5xl mb-4">🌱</div>
                <CardTitle className="text-2xl text-eco-green">Reduce Waste by 40%</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Accurate RSVPs mean no over-ordering food. Digital invites save paper. 
                  Every celebration becomes more sustainable without sacrificing the experience.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-eco-beige border-2 border-eco-green-light">
              <CardHeader>
                <div className="text-5xl mb-4">⏰</div>
                <CardTitle className="text-2xl text-eco-green">Save 10+ Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Track RSVPs and gifts in one dashboard. No more spreadsheets, 
                  WhatsApp chaos, or manual tracking. Everything organized automatically.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-eco-beige border-2 border-eco-green-light">
              <CardHeader>
                <div className="text-5xl mb-4">🎁</div>
                <CardTitle className="text-2xl text-eco-green">Meaningful Gifting</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Let guests gift what you'll actually use. Avoid duplicates, 
                  reduce returns, and ensure every gift is appreciated and useful.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-eco-beige py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-eco-green">How It Works</h2>
            <p className="text-xl text-gray-600">Get started in minutes, not hours</p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-8 border-2 border-eco-green-light shadow-sm">
                <div className="bg-eco-green text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-3 text-eco-green">Create Your Event</h3>
                <p className="text-gray-600 leading-relaxed">
                  Set up your event details in under 5 minutes. Add date, venue, and enable RSVP or Registry features.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-8 border-2 border-eco-green-light shadow-sm">
                <div className="bg-eco-green text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-3 text-eco-green">Share with Guests</h3>
                <p className="text-gray-600 leading-relaxed">
                  Send a simple link or QR code. Guests RSVP and browse your registry from any device, anywhere.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-8 border-2 border-eco-green-light shadow-sm">
                <div className="bg-eco-green text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-3 text-eco-green">Track Everything</h3>
                <p className="text-gray-600 leading-relaxed">
                  Real-time dashboard shows RSVPs, gift bookings, and sustainability impact. Export data anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-eco-green">Everything You Need</h2>
            <p className="text-xl text-gray-600">All features included, no hidden costs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: '📋', title: 'Smart RSVP Tracking', desc: 'Real-time responses with guest counts and meal preferences' },
              { icon: '🎁', title: 'Gift Registry', desc: 'Add items, track bookings, avoid duplicates' },
              { icon: '💳', title: 'Secure Payments', desc: 'Razorpay integration for seamless gift payments' },
              { icon: '📊', title: 'Analytics Dashboard', desc: 'See RSVP trends, gift analytics, and sustainability metrics' },
              { icon: '📧', title: 'Email Notifications', desc: 'Automatic updates to hosts and guests' },
              { icon: '📱', title: 'Mobile Friendly', desc: 'Works perfectly on phones, tablets, and desktops' },
              { icon: '🔒', title: 'Privacy First', desc: 'Your data is secure. We never share guest information' },
              { icon: '🌐', title: 'Public or Private', desc: 'Control who can see your event and registry' },
              { icon: '📥', title: 'CSV Export', desc: 'Download all data for your records anytime' },
            ].map((feature, idx) => (
              <Card key={idx} className="bg-eco-beige border border-eco-green-light hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="text-3xl mb-2">{feature.icon}</div>
                  <CardTitle className="text-lg text-eco-green">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="bg-eco-beige py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-eco-green">Loved by Hosts</h2>
            <p className="text-xl text-gray-600">See what others are saying</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Priya Sharma',
                event: 'Wedding',
                text: 'Saved us so much time! RSVPs were organized automatically and we avoided over-ordering food. Highly recommend!',
                rating: 5
              },
              {
                name: 'Rahul Mehta',
                event: 'Housewarming',
                text: 'The gift registry feature is amazing. No more duplicate gifts, and guests loved how easy it was to use.',
                rating: 5
              },
              {
                name: 'Anjali Patel',
                event: 'Birthday',
                text: 'Setup took 5 minutes. The dashboard is clean and the sustainability metrics are a nice touch. Great platform!',
                rating: 5
              },
            ].map((testimonial, idx) => (
              <Card key={idx} className="bg-white border-2 border-eco-green-light shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-yellow-400">★</span>
                    ))}
                  </div>
                  <CardDescription className="text-base">{testimonial.text}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold text-eco-green">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.event}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-eco-green py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4 text-white">Ready to Plan Your Perfect Event?</h2>
          <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of hosts who are making their celebrations more meaningful and sustainable.
          </p>
          <Link href="/host/signup">
            <Button className="bg-white text-eco-green hover:bg-green-50 px-10 py-7 text-lg rounded-full shadow-lg">
              Get Started Free →
            </Button>
          </Link>
          <p className="text-green-100 text-sm mt-4">No credit card required • Setup in 5 minutes • Free forever</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-eco-green-light py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🌿</span>
                <span className="text-lg font-bold text-eco-green">CelebrateMindfully</span>
              </div>
              <p className="text-sm text-gray-600">
                Making celebrations smarter, more sustainable, and more meaningful.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-eco-green">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/host/signup" className="hover:text-eco-green">Get Started</Link></li>
                <li><Link href="/host/login" className="hover:text-eco-green">Host Login</Link></li>
                <li><Link href="/registry/demo-wedding" className="hover:text-eco-green">View Demo</Link></li>
                <li><Link href="#" className="hover:text-eco-green">Features</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-eco-green">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-eco-green">About</Link></li>
                <li><Link href="#" className="hover:text-eco-green">Sustainability</Link></li>
                <li><Link href="#" className="hover:text-eco-green">Contact</Link></li>
                <li><Link href="#" className="hover:text-eco-green">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-eco-green">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#" className="hover:text-eco-green">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-eco-green">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-eco-green">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-eco-green-light pt-8 text-center text-sm text-gray-600">
            <p>© 2024 CelebrateMindfully. Made with 🌿 for sustainable celebrations.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
