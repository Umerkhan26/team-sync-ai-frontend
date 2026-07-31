import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { orgApi } from '@/services/orgApi'
import { setActiveOrganization } from '@/store/orgSlice'
import { setCredentials } from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'
import { PASSWORD_HINT, PASSWORD_REGEX } from '@/types'
import { getErrorMessage } from '@/utils/cn'

const activateSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(100),
  password: z.string().min(8, PASSWORD_HINT).regex(PASSWORD_REGEX, PASSWORD_HINT),
})

type ActivateForm = z.infer<typeof activateSchema>

export function AcceptInvitePage() {
  useSurfaceMode('marketing')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [manualToken, setManualToken] = useState(token)

  useEffect(() => {
    if (token) setManualToken(token)
  }, [token])

  const previewQuery = useQuery({
    queryKey: ['invite-preview', manualToken],
    queryFn: () => orgApi.previewInvite(manualToken),
    enabled: Boolean(manualToken),
    retry: false,
  })

  const activateForm = useForm<ActivateForm>({
    resolver: zodResolver(activateSchema),
    defaultValues: { name: '', password: '' },
  })

  useEffect(() => {
    if (previewQuery.data?.inviteeName) {
      activateForm.setValue('name', previewQuery.data.inviteeName)
    }
  }, [previewQuery.data, activateForm])

  const activateMutation = useMutation({
    mutationFn: (values: ActivateForm) =>
      orgApi.activateInvite({
        token: manualToken,
        name: values.name,
        password: values.password,
      }),
    onSuccess: async (result) => {
      dispatch(
        setCredentials({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        }),
      )
      const orgs = await orgApi.list()
      const match =
        orgs.find((o) => o.organization.id === result.organizationId) || orgs[0]
      if (match) {
        dispatch(
          setActiveOrganization({
            organization: match.organization,
            membership: {
              membershipId: match.membershipId,
              roleId: match.roleId,
              roleSlug: match.roleSlug || 'member',
              roleName: match.roleName || 'Member',
              permissions: match.permissions || [],
              status: match.status,
            },
          }),
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Welcome aboard — account activated')
      navigate('/app')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const acceptMutation = useMutation({
    mutationFn: () => orgApi.acceptInvite(manualToken),
    onSuccess: async () => {
      const orgs = await orgApi.list()
      const match =
        orgs.find((o) => o.organization.id === previewQuery.data?.organization.id) || orgs[0]
      if (match) {
        dispatch(
          setActiveOrganization({
            organization: match.organization,
            membership: {
              membershipId: match.membershipId,
              roleId: match.roleId,
              roleSlug: match.roleSlug || 'member',
              roleName: match.roleName || 'Member',
              permissions: match.permissions || [],
              status: match.status,
            },
          }),
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Invitation accepted')
      navigate('/app')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Join your company</CardTitle>
          <CardDescription>
            Accept a TeamSync invitation. Passwords are never sent by email — you create one here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <div className="space-y-2">
              <Label htmlFor="token">Invitation token</Label>
              <Input
                id="token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value.trim())}
                placeholder="Paste invite token"
              />
            </div>
          ) : null}

          {previewQuery.isLoading ? <LoadingState rows={3} /> : null}
          {previewQuery.isError ? (
            <ErrorState
              title="Invitation unavailable"
              message={getErrorMessage(previewQuery.error, 'Invalid or expired invitation')}
            />
          ) : null}

          {previewQuery.data ? (
            <div className="space-y-4">
              <div className="surface-panel space-y-2 p-4 text-sm">
                <p className="app-title text-base">
                  Welcome to {previewQuery.data.organization.name}
                </p>
                <p className="text-muted-foreground">
                  {previewQuery.data.inviter.name} invited{' '}
                  <strong>{previewQuery.data.email}</strong> as{' '}
                  <strong>{previewQuery.data.role.name}</strong>.
                </p>
                {previewQuery.data.department ? (
                  <p className="text-xs text-muted-foreground">
                    Department: {previewQuery.data.department}
                  </p>
                ) : null}
              </div>

              {previewQuery.data.accountExists ? (
                accessToken ? (
                  <Button
                    className="w-full"
                    loading={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate()}
                  >
                    Join workspace
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      An account already exists for this email. Sign in, then accept the invite.
                    </p>
                    <Button asChild className="w-full">
                      <Link
                        to={`/login?next=${encodeURIComponent(`/invitations/accept?token=${manualToken}`)}`}
                      >
                        Sign in to continue
                      </Link>
                    </Button>
                  </div>
                )
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={activateForm.handleSubmit((v) => activateMutation.mutate(v))}
                  noValidate
                >
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" {...activateForm.register('name')} />
                    {activateForm.formState.errors.name ? (
                      <p className="text-xs text-destructive">
                        {activateForm.formState.errors.name.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Create password</Label>
                    <Input id="password" type="password" {...activateForm.register('password')} />
                    <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                    {activateForm.formState.errors.password ? (
                      <p className="text-xs text-destructive">
                        {activateForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>
                  <Button className="w-full" type="submit" loading={activateMutation.isPending}>
                    Activate account & join
                  </Button>
                </form>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
