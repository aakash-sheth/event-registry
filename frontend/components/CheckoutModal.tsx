'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { formatPhoneWithCountryCode } from '@/lib/countryCodesFull'
import CountryCodeSelector from '@/components/CountryCodeSelector'

const checkoutSchema = z.object({
  buyer_name: z.string().min(1, 'Name is required'),
  buyer_email: z.string().email('Invalid email'),
  buyer_phone: z.string().optional(),
  country_code: z.string().optional(),
})

type CheckoutForm = z.infer<typeof checkoutSchema>

interface CheckoutModalProps {
  item: {
    id: number
    name: string
    price_inr: number
  }
  eventId: number
  eventCountryCode?: string
  onClose: () => void
  onSuccess: () => void
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export default function CheckoutModal({
  item,
  eventId,
  eventCountryCode = '+91',
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      country_code: eventCountryCode,
    },
  })

  const onSubmit = async (data: CheckoutForm) => {
    setLoading(true)
    try {
      // Format phone with country code if provided
      let formattedPhone = data.buyer_phone || ''
      if (formattedPhone) {
        const countryCode = data.country_code || eventCountryCode
        formattedPhone = formatPhoneWithCountryCode(formattedPhone, countryCode)
      }
      
      // Create order
      console.log('Creating order with:', {
        event_id: eventId,
        item_id: item.id,
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email,
        buyer_phone: formattedPhone,
      })
      
      const orderResponse = await api.post('/api/orders/', {
        event_id: eventId,
        item_id: item.id,
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email,
        buyer_phone: formattedPhone,
        country_code: data.country_code || eventCountryCode,
      })

      const { rzp_order_id, amount, currency, rzp_key_id } = orderResponse.data

      // Check if Razorpay is configured
      if (!rzp_key_id || rzp_order_id.startsWith('order_mock_')) {
        // Development mode - skip Razorpay and mark as paid
        showToast('Order created! (Payment skipped in development mode)', 'success')
        window.location.href = `/success?order_id=${orderResponse.data.order_id}&payment_id=mock_payment_${orderResponse.data.order_id}`
        return
      }

      // Load Razorpay script
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => {
        const options = {
          key: rzp_key_id,
          amount: amount,
          currency: currency,
          name: 'Event Registry',
          description: item.name,
          order_id: rzp_order_id,
          handler: function (response: any) {
            // Redirect to success page
            window.location.href = `/success?order_id=${orderResponse.data.order_id}&payment_id=${response.razorpay_payment_id}`
          },
          prefill: {
            name: data.buyer_name,
            email: data.buyer_email,
            contact: data.buyer_phone || '',
          },
          theme: {
            color: '#2563eb',
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
        setLoading(false)
      }
      script.onerror = () => {
        showToast('Failed to load payment gateway', 'error')
        setLoading(false)
      }
      document.body.appendChild(script)
    } catch (error: any) {
      console.error('Order creation error:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.detail ||
                          (typeof error.response?.data === 'object' ? JSON.stringify(error.response?.data) : 'Failed to create order')
      showToast(errorMessage, 'error')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Gift {item.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input {...register('buyer_name')} />
              {errors.buyer_name && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.buyer_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input type="email" {...register('buyer_email')} />
              {errors.buyer_email && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.buyer_email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Phone (optional)
              </label>
              <div className="flex gap-2">
                <CountryCodeSelector
                  {...register('country_code')}
                  defaultValue={eventCountryCode}
                  onChange={(value) => {
                    setValue('country_code', value, { shouldValidate: true })
                  }}
                  className="w-48"
                />
                <Input
                  type="tel"
                  {...register('buyer_phone')}
                  placeholder="Phone number"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between mb-4">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">
                  ₹{(item.price_inr / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

