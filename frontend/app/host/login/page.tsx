'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logDebug, logError } from '@/lib/error-handler'

const emailSchema = z.object({
  email: z.string().email('Invalid email'),
})

const codeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
})

type EmailForm = z.infer<typeof emailSchema>
type CodeForm = z.infer<typeof codeSchema>

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
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    mode: 'onSubmit',
  })

  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors },
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    mode: 'onSubmit',
  })

  const onEmailSubmit = async (data: { email: string }) => {
    logDebug('onEmailSubmit called with:', data)
    setLoading(true)
    try {
      const response = await api.post('/api/auth/otp/start', { email: data.email })
      logDebug('OTP response received')
      setEmail(data.email)
      setStep('code')
      
      // In development, show OTP if returned (for testing without email)
      if (response.data.otp_code) {
        logDebug('🔑 OTP Code (dev mode):', response.data.otp_code)
        showToast(`OTP Code: ${response.data.otp_code} (check console for details)`, 'info')
      } else {
        showToast('Verification code sent to your email', 'success')
      }
    } catch (error: any) {
      logError('OTP error:', error)
      showToast(getErrorMessage(error), 'error')
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
      logError('OTP verification error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-2 border-eco-green-light">
        <CardHeader className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <CardTitle className="text-2xl text-eco-green">Host Login</CardTitle>
          <CardDescription className="text-base">
            {step === 'email' 
              ? 'Enter your email to receive a login code'
              : `Enter the code sent to ${email}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form 
              onSubmit={handleSubmitEmail(onEmailSubmit)} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input
                  type="email"
                  {...registerEmail('email')}
                  placeholder="your@email.com"
                />
                {emailErrors.email && (
                  <p className="text-red-500 text-sm mt-1">
                    {emailErrors.email.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-eco-green hover:bg-green-600 text-white py-6 text-lg"
              >
                {loading ? 'Sending...' : 'Send Login Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmitCode(onCodeSubmit)} className="space-y-4">
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
                  {...registerCode('code')}
                  placeholder="000000"
                />
                {codeErrors.code && (
                  <p className="text-red-500 text-sm mt-1">
                    {codeErrors.code.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('email')}
                  className="flex-1 border-eco-green text-eco-green"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/host/signup" className="text-eco-green font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
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

