import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/services/authApi'
import { getErrorMessage } from '@/utils/cn'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.forgotPassword(values.email)
      setSent(true)
      toast.success('If that email exists, a 6-digit code was sent')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Request failed'))
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>
          We&apos;ll email you a 6-digit reset code if an account exists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-[hsl(152_55%_28%)]">
              Check your inbox for the 6-digit code.
            </p>
            <Button asChild className="w-full">
              <Link to="/reset-password">I have a reset code</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset email'}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
