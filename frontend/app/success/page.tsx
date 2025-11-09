'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const paymentId = searchParams.get('payment_id')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    // Show success immediately
    setConfirmed(true)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Thank you for your generous gift! We've received your payment and
            you'll receive a confirmation email shortly.
          </p>
          {orderId && (
            <p className="text-sm text-gray-500">
              Order ID: {orderId}
            </p>
          )}
          {paymentId && (
            <p className="text-sm text-gray-500">
              Payment ID: {paymentId}
            </p>
          )}
          <Button
            onClick={() => (window.location.href = '/')}
            className="w-full"
          >
            Return Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

