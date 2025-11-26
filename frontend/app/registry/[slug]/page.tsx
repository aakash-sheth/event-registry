'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CheckoutModal from '@/components/CheckoutModal'

interface Event {
  id: number
  title: string
  event_type: string
  date: string
  city: string
  country_code?: string
  banner_image?: string
  description?: string
  additional_photos?: string[]
  has_rsvp?: boolean
  has_registry?: boolean
}

interface Item {
  id: number
  name: string
  description: string
  image_url: string
  price_inr: number
  remaining: number
  is_available: boolean
}

export default function RegistryPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [event, setEvent] = useState<Event | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => {
    fetchRegistry()
  }, [slug])

  const fetchRegistry = async () => {
    try {
      const response = await api.get(`/api/registry/${slug}/items`)
      const eventData = response.data.event
      setEvent(eventData)
      
      // Check if registry is enabled - if not, items will be empty/error
      if (!eventData.has_registry) {
        setItems([])
        // Registry is disabled - we're on the invitation page which is correct
        // The invitation page will show but registry items will be hidden
      } else {
        setItems(response.data.items || [])
      }
    } catch (error: any) {
      console.error('Failed to fetch registry:', error)
      // If 403 error, registry is disabled - fetch event data separately
      if (error.response?.status === 403) {
        try {
          // Fetch event data from the public event endpoint
          const eventResponse = await api.get(`/api/registry/${slug}/`)
          setEvent(eventResponse.data)
          setItems([])
        } catch (eventError) {
          console.error('Failed to fetch event data:', eventError)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGift = (item: Item) => {
    setSelectedItem(item)
    setShowCheckout(true)
  }

  // Note: The registry page (/registry/[slug]) IS the invitation page
  // When registry is disabled, the page still works as invitation page
  // but registry items section is hidden (handled by conditional rendering)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-eco-beige to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-eco-green mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-eco-beige to-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-3xl font-bold text-eco-green mb-4">Event Not Found</h1>
          <p className="text-gray-600 mb-6">
            The event you're looking for doesn't exist or may have been removed.
          </p>
          <Link href="/">
            <Button className="bg-eco-green hover:bg-green-600 text-white">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-eco-beige to-white">
      {/* Hero Section with Banner */}
      <div className="relative w-full">
        {/* Banner Image with Overlay */}
        {event.banner_image && event.banner_image.trim() ? (
          <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden">
            <img
              src={event.banner_image}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>
            
            {/* Content Overlay */}
            <div className="absolute inset-0 flex flex-col justify-end items-center pb-12 md:pb-16 px-4">
              <div className="text-center text-white max-w-4xl">
                <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
                  {event.title}
                </h1>
                {event.date && (
                  <p className="text-xl md:text-2xl mb-2 drop-shadow-md font-light">
                  {new Date(event.date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                )}
                {event.city && (
                  <p className="text-lg md:text-xl drop-shadow-md font-light">
                    {event.city}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Fallback Hero without Banner */
          <div className="bg-gradient-to-r from-eco-green to-green-600 py-20 md:py-28">
            <div className="container mx-auto px-4 text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                {event.title}
              </h1>
              {event.date && (
                <p className="text-xl md:text-2xl text-white/90 mb-2 font-light">
                  {new Date(event.date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
              {event.city && (
                <p className="text-lg md:text-xl text-white/80 font-light">
                  {event.city}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl">
        {/* Description Section */}
        {event.description && event.description.trim() ? (
          <div className="mb-12 md:mb-16">
            <Card className="bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <div
                  className="text-gray-700 prose prose-lg md:prose-xl max-w-none text-center leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="mb-12 md:mb-16">
            <Card className="bg-white border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 md:p-12 text-center">
                <p className="text-gray-600 text-lg leading-relaxed">
                  We're excited to celebrate with you! More details about this event will be shared soon.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Photo Gallery */}
        {event.additional_photos && Array.isArray(event.additional_photos) && event.additional_photos.length > 0 && (
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-eco-green mb-6 text-center">
              Our Moments
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {event.additional_photos.filter(photo => photo && photo.trim()).map((photo, index) => (
                <div 
                  key={index} 
                  className="relative aspect-square group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300"
                >
                  <img
                    src={photo}
                    alt={`Event photo ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        {event.has_rsvp && (
          <div className="mb-12 md:mb-16 text-center">
            <Link href={`/event/${slug}/rsvp`}>
              <Button className="bg-eco-green hover:bg-green-600 text-white px-10 py-6 text-lg md:text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                RSVP Now 🌿
              </Button>
            </Link>
          </div>
        )}

        {/* Eco Message */}
        <div className="bg-gradient-to-r from-eco-green-light to-green-100 p-6 md:p-8 rounded-2xl mb-12 md:mb-16 text-center shadow-md">
          <p className="text-gray-800 text-lg md:text-xl">
            <strong>Every meaningful gift reduces waste.</strong> Help us celebrate sustainably!
          </p>
        </div>

        {/* Registry Items Section */}
        {event.has_registry && (
          <div className="mb-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-eco-green mb-3">
                Gift Registry
              </h2>
              <p className="text-gray-600 text-lg">
                Choose a meaningful gift to celebrate with us
              </p>
            </div>

            {items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {items.map((item) => (
                <Card 
                  key={item.id} 
                  className="bg-white border-0 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden group transform hover:-translate-y-2"
                >
                  {item.image_url && (
                    <div className="relative h-56 md:h-64 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute top-4 right-4">
                        {item.remaining > 0 ? (
                          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                            {item.remaining} left
                          </span>
                        ) : (
                          <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl md:text-2xl text-eco-green mb-2">
                      {item.name}
                    </CardTitle>
                    {item.description && (
                      <CardDescription className="text-gray-600 line-clamp-2">
                        {item.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-3xl font-bold text-eco-green">
                        ₹{(item.price_inr / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleGift(item)}
                      disabled={!item.is_available}
                      className={`w-full py-6 text-base font-semibold rounded-xl transition-all duration-300 ${
                        item.is_available
                          ? 'bg-eco-green hover:bg-green-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {item.is_available ? 'Gift This' : 'Out of Stock'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-white border-0 shadow-lg rounded-2xl">
              <CardContent className="p-12 text-center">
                <p className="text-gray-500 text-lg mb-2">No items available at the moment.</p>
                <p className="text-gray-400 text-sm">
                  The host hasn't added any items to this registry yet. Check back soon!
                </p>
              </CardContent>
            </Card>
          )}
          </div>
        )}
      </div>

      {showCheckout && selectedItem && (
        <CheckoutModal
          item={selectedItem}
          eventId={event.id}
          eventCountryCode={event.country_code || '+91'}
          onClose={() => {
            setShowCheckout(false)
            setSelectedItem(null)
          }}
          onSuccess={() => {
            setShowCheckout(false)
            setSelectedItem(null)
            fetchRegistry() // Refresh items
          }}
        />
      )}
    </div>
  )
}

