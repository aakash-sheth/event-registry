'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
})

const codeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
})

type SignupForm = z.infer<typeof signupSchema>
type CodeForm = z.infer<typeof codeSchema>

function SignupForm() {
  const router = useRouter()
  const { showToast } = useToast()
  const [step, setStep] = useState<'signup' | 'verify'>('signup')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register: registerSignup,
    handleSubmit: handleSubmitSignup,
    formState: { errors: signupErrors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors },
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  })

  const onSignupSubmit = async (data: SignupForm) => {
    setLoading(true)
    try {
      // First, register the user with name
      const response = await api.post('/api/auth/signup/', {
        name: data.name,
        email: data.email,
      })
      
      setEmail(data.email)
      setName(data.name)
      setStep('verify')
      
      // In development, show OTP if returned (for testing without email)
      if (response.data.otp_code) {
        logDebug('🔑 OTP Code (dev mode):', response.data.otp_code)
        showToast(`OTP Code: ${response.data.otp_code} (check console for details)`, 'info')
      } else {
        showToast('Verification code sent to your email', 'success')
      }
    } catch (error: any) {
      logError('Signup error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const onCodeSubmit = async (data: { code: string }) => {
    setLoading(true)
    try {
      const response = await api.post('/api/auth/otp/verify/', {
        email,
        code: data.code,
      })
      localStorage.setItem('access_token', response.data.access)
      localStorage.setItem('refresh_token', response.data.refresh)
      showToast('Account created successfully! Welcome! 🌿', 'success')
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
          <CardTitle className="text-2xl text-eco-green">Create Your Account</CardTitle>
          <CardDescription className="text-base">
            {step === 'signup' 
              ? 'Start planning sustainable celebrations in minutes'
              : `Enter the verification code sent to ${email}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'signup' ? (
            <form 
              onSubmit={handleSubmitSignup(onSignupSubmit)} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Full Name *
                </label>
                <Input
                  type="text"
                  {...registerSignup('name')}
                  placeholder="Your name"
                  className="border-eco-green-light focus:border-eco-green"
                />
                {signupErrors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {signupErrors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Email Address *
                </label>
                <Input
                  type="email"
                  {...registerSignup('email')}
                  placeholder="your@email.com"
                  className="border-eco-green-light focus:border-eco-green"
                />
                {signupErrors.email && (
                  <p className="text-red-500 text-sm mt-1">
                    {signupErrors.email.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-eco-green hover:bg-green-600 text-white py-6 text-lg"
              >
                {loading ? 'Creating Account...' : 'Create Account →'}
              </Button>
              <p className="text-xs text-center text-gray-500 mt-4">
                By creating an account, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmitCode(onCodeSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Verification Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  {...registerCode('code')}
                  placeholder="000000"
                  className="border-eco-green-light focus:border-eco-green text-center text-2xl tracking-widest"
                />
                {codeErrors.code && (
                  <p className="text-red-500 text-sm mt-1">
                    {codeErrors.code.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Check your email for the 6-digit code
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('signup')}
                  className="flex-1 border-eco-green text-eco-green"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
              </div>
            </form>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/host/login" className="text-eco-green font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-eco-beige flex items-center justify-center">Loading...</div>}>
      <SignupForm />
    </Suspense>
  )
}

