import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/services/authApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { logout, setUser } from '@/store/authSlice'
import { getErrorMessage } from '@/utils/cn'

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
})

type FormValues = z.infer<typeof schema>

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: searchParams.get('code') || '',
    },
  })

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) setValue('code', code)
  }, [searchParams, setValue])

  useEffect(() => {
    if (user?.emailVerifiedAt) {
      navigate('/app', { replace: true })
    }
  }, [user, navigate])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await authApi.verifyEmail({
        code: values.code,
        email: user?.email,
      })
      dispatch(setUser(result.user))
      setStatus('success')
      toast.success('Email verified')
      navigate('/app')
    } catch (error) {
      setStatus('error')
      toast.error(getErrorMessage(error, 'Verification failed'))
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify email</CardTitle>
        <CardDescription>
          Enter the 6-digit code we sent
          {user?.email ? ` to ${user.email}` : ' to your email'}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="tracking-[0.35em] text-center text-lg font-semibold"
              {...register('code')}
            />
            {errors.code ? (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying…' : 'Verify email'}
          </Button>
        </form>
        {status === 'success' ? (
          <p className="mt-3 text-sm text-[hsl(152_55%_28%)]">Email verified successfully.</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={async () => {
              try {
                const result = await authApi.resendVerification()
                toast.success(
                  result.verificationCode
                    ? `Code sent. Dev code: ${result.verificationCode}`
                    : 'A new 6-digit code was sent to your email',
                )
              } catch (error) {
                toast.error(getErrorMessage(error, 'Could not resend code'))
              }
            }}
          >
            Resend code
          </button>
          <div className="flex items-center justify-between">
            <Link to="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                dispatch(logout())
                navigate('/login')
              }}
            >
              Use another account
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
