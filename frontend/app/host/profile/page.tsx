'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import Logo from '@/components/Logo'

const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

const changePasswordSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

const disablePasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

type SetPasswordForm = z.infer<typeof setPasswordSchema>
type ChangePasswordForm = z.infer<typeof changePasswordSchema>
type DisablePasswordForm = z.infer<typeof disablePasswordSchema>

interface User {
  id: number
  email: string
  name: string
  email_verified: boolean
  has_password: boolean
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'none' | 'set' | 'change' | 'disable'>('none')
  const [submitting, setSubmitting] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)

  const {
    register: registerSetPassword,
    handleSubmit: handleSubmitSetPassword,
    formState: { errors: setPasswordErrors },
    reset: resetSetPassword,
  } = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    mode: 'onSubmit',
  })

  const {
    register: registerChangePassword,
    handleSubmit: handleSubmitChangePassword,
    formState: { errors: changePasswordErrors },
    reset: resetChangePassword,
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onSubmit',
  })

  const {
    register: registerDisablePassword,
    handleSubmit: handleSubmitDisablePassword,
    formState: { errors: disablePasswordErrors },
    reset: resetDisablePassword,
  } = useForm<DisablePasswordForm>({
    resolver: zodResolver(disablePasswordSchema),
    mode: 'onSubmit',
  })

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/auth/me/')
      setUser(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else {
        logError('Failed to fetch user:', error)
        showToast('Failed to load profile', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const onSetPassword = async (data: SetPasswordForm) => {
    setSubmitting(true)
    try {
      await api.post('/api/auth/set-password/', { password: data.password })
      showToast('Password set successfully', 'success')
      setAction('none')
      resetSetPassword()
      await fetchUser() // Refresh user data
    } catch (error: any) {
      logError('Set password error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const sendOtpForPasswordChange = async () => {
    if (!user) return
    
    setSendingOtp(true)
    try {
      await api.post('/api/auth/otp/start', { email: user.email })
      setOtpSent(true)
      showToast('Verification code sent to your email', 'success')
    } catch (error: any) {
      logError('Send OTP error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSendingOtp(false)
    }
  }

  const onChangePassword = async (data: ChangePasswordForm) => {
    setSubmitting(true)
    try {
      await api.post('/api/auth/change-password/', {
        code: data.code,
        new_password: data.newPassword,
      })
      showToast('Password changed successfully', 'success')
      setAction('none')
      setOtpSent(false)
      resetChangePassword()
    } catch (error: any) {
      logError('Change password error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const onDisablePassword = async (data: DisablePasswordForm) => {
    setSubmitting(true)
    try {
      await api.post('/api/auth/disable-password/', { password: data.password })
      showToast('Password disabled successfully', 'success')
      setAction('none')
      resetDisablePassword()
      await fetchUser() // Refresh user data
    } catch (error: any) {
      logError('Disable password error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const validatePasswordStrength = (password: string): { strength: 'weak' | 'medium' | 'strong', message: string } => {
    if (password.length < 8) {
      return { strength: 'weak', message: 'Password must be at least 8 characters' }
    }
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^a-zA-Z0-9]/.test(password)
    
    if (hasLetter && hasNumber && hasSpecial && password.length >= 12) {
      return { strength: 'strong', message: 'Strong password' }
    } else if (hasLetter && hasNumber) {
      return { strength: 'medium', message: 'Medium strength - add special characters for stronger password' }
    } else {
      return { strength: 'weak', message: 'Weak password - add letters and numbers' }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      {/* Header */}
      <nav className="bg-white border-b border-eco-green-light shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo href="/" />
          <div className="flex items-center gap-4">
            <Link href="/host/dashboard">
              <Button variant="ghost" className="text-eco-green">
                Dashboard
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                router.push('/host/login')
              }}
              className="text-eco-green"
            >
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-4xl font-bold mb-8 text-eco-green">Profile Settings</h1>

        {/* User Information */}
        <Card className="bg-white border-2 border-eco-green-light mb-6">
          <CardHeader>
            <CardTitle className="text-eco-green">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <p className="text-gray-900">{user.name || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Verified</label>
              <p className={user.email_verified ? 'text-green-600' : 'text-red-600'}>
                {user.email_verified ? '✓ Verified' : '✗ Not verified'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Created</label>
              <p className="text-gray-900">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Password Management */}
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Password Management</CardTitle>
            <CardDescription>
              {user.has_password
                ? 'You have password login enabled. You can change or disable it below.'
                : 'Enable password login to use password authentication alongside OTP.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!user.has_password && action !== 'set' && (
              <Button
                onClick={() => setAction('set')}
                className="w-full bg-eco-green hover:bg-green-600 text-white"
              >
                Set Password
              </Button>
            )}

            {user.has_password && action === 'none' && (
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setAction('change')
                    setOtpSent(false)
                  }}
                  className="w-full bg-eco-green hover:bg-green-600 text-white"
                >
                  Change Password
                </Button>
                <Button
                  onClick={() => setAction('disable')}
                  variant="outline"
                  className="w-full border-red-500 text-red-500 hover:bg-red-50"
                >
                  Disable Password
                </Button>
              </div>
            )}

            {action === 'set' && (
              <form onSubmit={handleSubmitSetPassword(onSetPassword)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <Input
                    type="password"
                    {...registerSetPassword('password')}
                    placeholder="Enter new password (min 8 characters)"
                    autoComplete="new-password"
                  />
                  {setPasswordErrors.password && (
                    <p className="text-red-500 text-sm mt-1">
                      {setPasswordErrors.password.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm Password</label>
                  <Input
                    type="password"
                    {...registerSetPassword('confirmPassword')}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                  {setPasswordErrors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">
                      {setPasswordErrors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAction('none')
                      resetSetPassword()
                    }}
                    className="flex-1 border-eco-green text-eco-green"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                  >
                    {submitting ? 'Setting...' : 'Set Password'}
                  </Button>
                </div>
              </form>
            )}

            {action === 'change' && (
              <form onSubmit={handleSubmitChangePassword(onChangePassword)} className="space-y-4">
                {!otpSent ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        We'll send a verification code to your email to confirm your identity before changing your password.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={sendOtpForPasswordChange}
                      disabled={sendingOtp}
                      className="w-full bg-eco-green hover:bg-green-600 text-white"
                    >
                      {sendingOtp ? 'Sending...' : 'Send Verification Code'}
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Verification Code</label>
                      <Input
                        type="text"
                        maxLength={6}
                        {...registerChangePassword('code')}
                        placeholder="Enter 6-digit code"
                      />
                      {changePasswordErrors.code && (
                        <p className="text-red-500 text-sm mt-1">
                          {changePasswordErrors.code.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Enter the 6-digit code sent to {user?.email}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">New Password</label>
                      <Input
                        type="password"
                        {...registerChangePassword('newPassword')}
                        placeholder="Enter new password (min 8 characters)"
                        autoComplete="new-password"
                      />
                      {changePasswordErrors.newPassword && (
                        <p className="text-red-500 text-sm mt-1">
                          {changePasswordErrors.newPassword.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                      <Input
                        type="password"
                        {...registerChangePassword('confirmPassword')}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                      />
                      {changePasswordErrors.confirmPassword && (
                        <p className="text-red-500 text-sm mt-1">
                          {changePasswordErrors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAction('none')
                          setOtpSent(false)
                          resetChangePassword()
                        }}
                        className="flex-1 border-eco-green text-eco-green"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 bg-eco-green hover:bg-green-600 text-white"
                      >
                        {submitting ? 'Changing...' : 'Change Password'}
                      </Button>
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={sendOtpForPasswordChange}
                        disabled={sendingOtp}
                        className="text-sm text-eco-green hover:underline"
                      >
                        {sendingOtp ? 'Sending...' : "Didn't receive code? Resend"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {action === 'disable' && (
              <form onSubmit={handleSubmitDisablePassword(onDisablePassword)} className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Disabling password will remove password login. You will only be able to login using OTP (verification code).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <Input
                    type="password"
                    {...registerDisablePassword('password')}
                    placeholder="Enter current password to confirm"
                    autoComplete="current-password"
                  />
                  {disablePasswordErrors.password && (
                    <p className="text-red-500 text-sm mt-1">
                      {disablePasswordErrors.password.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAction('none')
                      resetDisablePassword()
                    }}
                    className="flex-1 border-eco-green text-eco-green"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  >
                    {submitting ? 'Disabling...' : 'Disable Password'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

