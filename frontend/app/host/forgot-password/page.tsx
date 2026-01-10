'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'

const emailSchema = z.object({
  email: z.string().email('Invalid email'),
})

type EmailForm = z.infer<typeof emailSchema>

export default function ForgotPasswordPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    mode: 'onSubmit',
  })

  const onSubmit = async (data: EmailForm) => {
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password/', { email: data.email })
      setEmailSent(true)
      showToast('Password reset link sent to your email', 'success')
    } catch (error: any) {
      logError('Forgot password error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-2 border-eco-green-light">
        <CardHeader className="text-center">
          <div className="text-4xl mb-4">🔐</div>
          <CardTitle className="text-2xl text-eco-green">Forgot Password</CardTitle>
          <CardDescription className="text-base">
            {emailSent
              ? 'Check your email for password reset instructions'
              : 'Enter your email to receive a password reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  If an account exists with this email, a password reset link has been sent. 
                  Please check your email and click the link to reset your password.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/host/login" className="flex-1">
                  <Button className="w-full bg-eco-green hover:bg-green-600 text-white">
                    Back to Login
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => setEmailSent(false)}
                  className="flex-1 border-eco-green text-eco-green"
                >
                  Send Another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input
                  type="email"
                  {...register('email')}
                  placeholder="your@email.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-eco-green hover:bg-green-600 text-white py-6 text-lg"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <div className="text-center">
                <Link
                  href="/host/login"
                  className="text-sm text-eco-green hover:underline"
                >
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

