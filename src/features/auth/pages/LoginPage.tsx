import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/services/authApi'
import { useAppDispatch } from '@/store'
import { setCredentials } from '@/store/authSlice'
import { getErrorMessage } from '@/utils/cn'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const nextParam = searchParams.get('next')
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)
    ?.from
  const fromPath = from
    ? `${from.pathname || ''}${from.search || ''}`
    : null

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await authApi.login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })
      dispatch(setCredentials(result))
      toast.success('Welcome back')
      if (!result.user.emailVerifiedAt) {
        navigate('/verify-email')
        return
      }
      const dest =
        (nextParam && nextParam.startsWith('/') ? nextParam : null) ||
        (fromPath && fromPath.startsWith('/') ? fromPath : null) ||
        '/app'
      navigate(dest)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Login failed'))
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your TeamSync AI workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
