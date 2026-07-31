import { useEffect } from 'react'
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
import { PASSWORD_HINT, PASSWORD_REGEX } from '@/types'
import { getErrorMessage } from '@/utils/cn'

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
    password: z.string().min(8, PASSWORD_HINT).regex(PASSWORD_REGEX, PASSWORD_HINT),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: searchParams.get('code') || '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) setValue('code', code)
  }, [searchParams, setValue])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.resetPassword(values.code, values.password)
      toast.success('Password updated. Please sign in.')
      navigate('/login')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Reset failed'))
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter the 6-digit code from your email and choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="code">Reset code</Label>
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
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" {...register('password')} />
            <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword ? (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
