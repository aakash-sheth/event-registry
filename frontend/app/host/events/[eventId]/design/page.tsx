'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

const designSchema = z.object({
  banner_image: z.string().url('Invalid URL').optional().or(z.literal('')),
  description: z.string().optional(),
  additional_photos: z.array(z.string().url('Invalid URL')).max(5, 'Maximum 5 photos allowed').optional(),
})

type DesignForm = z.infer<typeof designSchema>

interface Event {
  id: number
  title: string
  slug: string
  banner_image: string
  description: string
  additional_photos: string[]
}

export default function DesignEventPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bannerPreview, setBannerPreview] = useState<string>('')
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DesignForm>({
    resolver: zodResolver(designSchema),
    defaultValues: {
      banner_image: '',
      description: '',
      additional_photos: [],
    },
  })

  const watchedBanner = watch('banner_image')
  const watchedPhotos = watch('additional_photos') || []

  useEffect(() => {
    fetchEvent()
  }, [eventId])

  useEffect(() => {
    if (watchedBanner) {
      setBannerPreview(watchedBanner)
    } else if (event?.banner_image) {
      setBannerPreview(event.banner_image)
    } else {
      setBannerPreview('')
    }
  }, [watchedBanner, event?.banner_image])

  useEffect(() => {
    if (watchedPhotos && watchedPhotos.length > 0) {
      setPhotoPreviews(watchedPhotos)
    } else if (event?.additional_photos && event.additional_photos.length > 0) {
      setPhotoPreviews(event.additional_photos)
    } else {
      setPhotoPreviews([])
    }
  }, [watchedPhotos, event?.additional_photos])

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      const eventData = response.data
      setEvent(eventData)
      setValue('banner_image', eventData.banner_image || '')
      setValue('description', eventData.description || '')
      setValue('additional_photos', eventData.additional_photos || [])
      if (eventData.banner_image) {
        setBannerPreview(eventData.banner_image)
      }
      if (eventData.additional_photos) {
        setPhotoPreviews(eventData.additional_photos)
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else {
        console.error('Failed to fetch event:', error)
        showToast('Failed to load event', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBannerUpload = () => {
    bannerInputRef.current?.click()
  }

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Banner image must be less than 5MB', 'error')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    // For MVP: Convert to data URL (in production, upload to S3 and get URL)
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setValue('banner_image', dataUrl)
      setBannerPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handlePhotoUpload = () => {
    photoInputRef.current?.click()
  }

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const currentPhotos = watchedPhotos || []
    if (currentPhotos.length + files.length > 5) {
      showToast('Maximum 5 photos allowed. Please remove some photos first.', 'error')
      return
    }

    const newPhotoUrls: string[] = []
    for (const file of files) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast(`${file.name} is too large. Maximum 5MB per photo.`, 'error')
        continue
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} is not an image file.`, 'error')
        continue
      }

      // For MVP: Convert to data URL (in production, upload to S3 and get URL)
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        newPhotoUrls.push(dataUrl)
        
        if (newPhotoUrls.length === files.length) {
          const updatedPhotos = [...currentPhotos, ...newPhotoUrls]
          setValue('additional_photos', updatedPhotos)
          setPhotoPreviews(updatedPhotos)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = (index: number) => {
    const currentPhotos = watchedPhotos || []
    const updatedPhotos = currentPhotos.filter((_, i) => i !== index)
    setValue('additional_photos', updatedPhotos)
    setPhotoPreviews(updatedPhotos)
  }

  const onSubmit = async (data: DesignForm) => {
    setSaving(true)
    try {
      await api.put(`/api/events/${eventId}/design/`, {
        banner_image: data.banner_image || '',
        description: data.description || '',
        additional_photos: data.additional_photos || [],
      })
      showToast('Event page design saved successfully!', 'success')
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to save design'
      showToast(errorMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href={`/host/events/${eventId}`}>
            <Button variant="outline" className="mb-4 border-eco-green text-eco-green hover:bg-eco-green-light">
              ← Back to Event
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold mb-2 text-eco-green">Design Event Page</h1>
            <p className="text-gray-700">
              Customize your public invitation page. This will appear when guests click your RSVP link.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6">
            {/* Banner Image */}
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Banner Photo</CardTitle>
                <CardDescription>
                  This image will appear at the top of your invitation page and in WhatsApp link previews
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  className="hidden"
                />
                {bannerPreview ? (
                  <div className="relative">
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      className="w-full h-64 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setValue('banner_image', '')
                        setBannerPreview('')
                      }}
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <div className="text-4xl mb-4">📸</div>
                    <p className="text-gray-600 mb-4">No banner image uploaded</p>
                    <Button
                      type="button"
                      onClick={handleBannerUpload}
                      className="bg-eco-green hover:bg-green-600 text-white"
                    >
                      Upload Banner Photo
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">Max 5MB • Recommended: 1200x400px</p>
                  </div>
                )}
                {!bannerPreview && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Or enter image URL</label>
                    <Input
                      {...register('banner_image')}
                      placeholder="https://example.com/image.jpg"
                      type="url"
                    />
                    {errors.banner_image && (
                      <p className="text-red-500 text-sm mt-1">{errors.banner_image.message}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Description</CardTitle>
                <CardDescription>
                  Add a personal message or event details. Supports rich text formatting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  {...register('description')}
                  rows={8}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
                  placeholder="We're excited to celebrate with you! 🌿 Your presence means the most to us..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  You can use basic HTML for formatting (e.g., &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;)
                </p>
              </CardContent>
            </Card>

            {/* Additional Photos */}
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Additional Photos</CardTitle>
                <CardDescription>
                  Add up to 5 photos to showcase your event (max 5MB each)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
                
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photoPreviews.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removePhoto(index)}
                          className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 border-red-300"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {photoPreviews.length < 5 && (
                  <div>
                    <Button
                      type="button"
                      onClick={handlePhotoUpload}
                      variant="outline"
                      className="border-eco-green text-eco-green hover:bg-eco-green-light"
                    >
                      + Add Photo ({photoPreviews.length}/5)
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">Max 5MB per photo</p>
                  </div>
                )}

                {errors.additional_photos && (
                  <p className="text-red-500 text-sm mt-1">{errors.additional_photos.message}</p>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="bg-white border-2 border-eco-green-light">
              <CardHeader>
                <CardTitle className="text-eco-green">Preview</CardTitle>
                <CardDescription>
                  How your invitation page will look to guests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                  {bannerPreview && (
                    <img
                      src={bannerPreview}
                      alt="Banner"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-eco-green mb-2">{event?.title}</h2>
                    {watch('description') && (
                      <div
                        className="text-gray-700 mb-4 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: watch('description') }}
                      />
                    )}
                    {photoPreviews.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {photoPreviews.map((photo, index) => (
                          <img
                            key={index}
                            src={photo}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-eco-green hover:bg-green-600 text-white"
              >
                {saving ? 'Saving...' : 'Save Design'}
              </Button>
              <Link href={`/host/events/${eventId}`}>
                <Button type="button" variant="outline" className="border-gray-300">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

