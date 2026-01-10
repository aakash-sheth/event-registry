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

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

type EmailForm = z.infer<typeof emailSchema>
type CodeForm = z.infer<typeof codeSchema>
type PasswordForm = z.infer<typeof passwordSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [step, setStep] = useState<'email' | 'choice' | 'code' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp' | null>(null)

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

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    mode: 'onSubmit',
  })

  const onEmailSubmit = async (data: { email: string }) => {
    logDebug('onEmailSubmit called with:', data)
    setLoading(true)
    try {
      setEmail(data.email)
      
      // Check if password is enabled for this email
      const checkResponse = await api.get(`/api/auth/check-password-enabled/?email=${encodeURIComponent(data.email)}`)
      const passwordEnabled = checkResponse.data.has_password
      setHasPassword(passwordEnabled)
      
      // Check if user has a remembered preference
      const rememberedMethod = localStorage.getItem(`login_method_${data.email}`) as 'password' | 'otp' | null
      
      if (passwordEnabled && rememberedMethod) {
        // Use remembered method
        setLoginMethod(rememberedMethod)
        if (rememberedMethod === 'password') {
          setStep('password')
        } else {
          await startOtpFlow(data.email)
        }
      } else if (passwordEnabled) {
        // Show choice screen
        setStep('choice')
      } else {
        // No password, go directly to OTP
        await startOtpFlow(data.email)
      }
    } catch (error: any) {
      logError('Email submit error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const startOtpFlow = async (emailAddress: string) => {
    try {
      const response = await api.post('/api/auth/otp/start', { email: emailAddress })
      logDebug('OTP response received')
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
      throw error
    }
  }

  const onMethodChoice = async (method: 'password' | 'otp') => {
    setLoginMethod(method)
    // Remember choice
    localStorage.setItem(`login_method_${email}`, method)
    
    if (method === 'password') {
      setStep('password')
    } else {
      setLoading(true)
      try {
        await startOtpFlow(email)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleLoginSuccess = (response: any) => {
    // Set tokens
    localStorage.setItem('access_token', response.data.access)
    localStorage.setItem('refresh_token', response.data.refresh)
    
    // CRITICAL: Verify token is actually set (handles slow localStorage on new devices)
    // Wait up to 500ms (10 attempts × 50ms) to verify token is saved
    const verifyTokenSet = async (maxAttempts = 10, delay = 50) => {
      for (let i = 0; i < maxAttempts; i++) {
        const token = localStorage.getItem('access_token')
        if (token === response.data.access) {
          return true
        }
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      return false
    }
    
    return verifyTokenSet()
  }

  const onCodeSubmit = async (data: { code: string }) => {
    setLoading(true)
    try {
      const response = await api.post('/api/auth/otp/verify', {
        email,
        code: data.code,
      })
      
      const tokenVerified = await handleLoginSuccess(response)
      if (!tokenVerified) {
        throw new Error('Failed to save authentication token. Please try again.')
      }
      
      showToast('Login successful!', 'success')
      
      // Use window.location.href for full page reload (ensures clean state)
      // This is more reliable than router.push for post-login navigation
      window.location.href = '/host/dashboard'
    } catch (error: any) {
      logError('OTP verification error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const onPasswordSubmit = async (data: { password: string }) => {
    setLoading(true)
    try {
      const response = await api.post('/api/auth/password-login', {
        email,
        password: data.password,
      })
      
      const tokenVerified = await handleLoginSuccess(response)
      if (!tokenVerified) {
        throw new Error('Failed to save authentication token. Please try again.')
      }
      
      showToast('Login successful!', 'success')
      
      // Use window.location.href for full page reload (ensures clean state)
      window.location.href = '/host/dashboard'
    } catch (error: any) {
      logError('Password login error:', error)
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
              ? 'Enter your email to continue'
              : step === 'choice'
              ? 'Choose your login method'
              : step === 'password'
              ? `Enter your password for ${email}`
              : `Enter the 6-digit verification code sent to ${email}`
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
                {loading ? 'Checking...' : 'Continue'}
              </Button>
            </form>
          ) : step === 'choice' ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border-2 border-eco-green-light rounded-lg cursor-pointer hover:bg-eco-green-light/10 transition-colors">
                  <input
                    type="radio"
                    name="loginMethod"
                    value="password"
                    checked={loginMethod === 'password'}
                    onChange={() => setLoginMethod('password')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-eco-green">Password</div>
                    <div className="text-sm text-gray-600">Login with your password</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-4 border-2 border-eco-green-light rounded-lg cursor-pointer hover:bg-eco-green-light/10 transition-colors">
                  <input
                    type="radio"
                    name="loginMethod"
                    value="otp"
                    checked={loginMethod === 'otp'}
                    onChange={() => setLoginMethod('otp')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-eco-green">Verification Code (OTP)</div>
                    <div className="text-sm text-gray-600">Receive a code via email</div>
                  </div>
                </label>
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
                  type="button"
                  onClick={() => loginMethod && onMethodChoice(loginMethod)}
                  disabled={loading || !loginMethod}
                  className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                >
                  {loading ? 'Loading...' : 'Continue'}
                </Button>
              </div>
            </div>
          ) : step === 'password' ? (
            <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  {...registerPassword('password')}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                {passwordErrors.password && (
                  <p className="text-red-500 text-sm mt-1">
                    {passwordErrors.password.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (hasPassword) {
                      setStep('choice')
                    } else {
                      setStep('email')
                    }
                  }}
                  className="flex-1 border-eco-green text-eco-green"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </div>
              <div className="text-center">
                <Link 
                  href="/host/forgot-password" 
                  className="text-sm text-eco-green hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitCode(onCodeSubmit)} className="space-y-4">
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
                <p className="text-xs text-gray-500 mt-2">
                  The code expires in 15 minutes.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (hasPassword) {
                      setStep('choice')
                    } else {
                      setStep('email')
                    }
                  }}
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
              <p className="text-sm text-gray-600 text-center mt-4">
                Didn't receive the code? Go back to resend.
              </p>
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

