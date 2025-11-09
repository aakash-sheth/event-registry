'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  code: z.string().length(6, 'Code must be 6 digits'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if coming from email link
    const token = searchParams.get('token')
    const emailParam = searchParams.get('email')
    if (token && emailParam) {
      // Auto-verify with token (simplified - in production, verify token on backend)
      setEmail(emailParam)
      setStep('code')
    }
  }, [searchParams])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onEmailSubmit = async (data: { email: string }) => {
    setLoading(true)
    try {
      await api.post('/api/auth/otp/start', { email: data.email })
      setEmail(data.email)
      setStep('code')
      showToast('OTP sent to your email', 'success')
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Failed to send OTP',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  const onCodeSubmit = async (data: { code: string }) => {
    setLoading(true)
    try {
      const response = await api.post('/api/auth/otp/verify', {
        email,
        code: data.code,
      })
      localStorage.setItem('access_token', response.data.access)
      localStorage.setItem('refresh_token', response.data.refresh)
      showToast('Login successful!', 'success')
      router.push('/host/dashboard')
    } catch (error: any) {
      showToast(
        error.response?.data?.error || 'Invalid code',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Host Login</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
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
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Login Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onCodeSubmit)} className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Enter the 6-digit code sent to {email}
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Verification Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  {...register('code')}
                  placeholder="000000"
                />
                {errors.code && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('email')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}

