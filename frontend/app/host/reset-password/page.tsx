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
import { getErrorMessage, logError } from '@/lib/error-handler'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    const emailParam = searchParams.get('email')
    
    if (!tokenParam || !emailParam) {
      showToast('Invalid reset link. Please request a new password reset.', 'error')
      router.push('/host/forgot-password')
      return
    }
    
    setToken(tokenParam)
    setEmail(emailParam)
  }, [searchParams, router, showToast])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onSubmit',
  })

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token || !email) {
      showToast('Invalid reset link', 'error')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/auth/reset-password/', {
        token,
        email,
        new_password: data.password,
      })
      showToast('Password reset successfully! You can now login with your new password.', 'success')
      router.push('/host/login')
    } catch (error: any) {
      logError('Reset password error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white border-2 border-eco-green-light">
          <CardContent className="text-center py-8">
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-2 border-eco-green-light">
        <CardHeader className="text-center">
          <div className="text-4xl mb-4">🔑</div>
          <CardTitle className="text-2xl text-eco-green">Reset Password</CardTitle>
          <CardDescription className="text-base">
            Enter your new password for {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <Input
                type="password"
                {...register('password')}
                placeholder="Enter new password (min 8 characters)"
                autoComplete="new-password"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Password must be at least 8 characters and contain letters and numbers.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <Input
                type="password"
                {...register('confirmPassword')}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-eco-green hover:bg-green-600 text-white py-6 text-lg"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
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
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

