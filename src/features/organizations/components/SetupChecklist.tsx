import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveOrganization } from '@/store/orgSlice'
import { orgApi } from '@/services/orgApi'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/utils/cn'
import { usePermissions } from '@/hooks/usePermissions'

export function SetupChecklist() {
  const org = useAppSelector((s) => s.org.activeOrganization)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const { can, isOwner, isAdmin } = usePermissions()

  const onboarding = org?.onboarding
  if (!org || !onboarding) return null
  if (!isOwner && !isAdmin) return null

  const steps = [
    {
      key: 'profileCompleted',
      done: onboarding.profileCompleted,
      title: 'Company profile',
      description: 'Company size, industry, and timezone',
      to: '/app/admin',
    },
    {
      key: 'invitedMembers',
      done: onboarding.invitedMembers,
      title: 'Invite teammates',
      description: 'Send secure invitations (no passwords in email)',
      to: '/app/admin',
    },
    {
      key: 'createdProject',
      done: onboarding.createdProject,
      title: 'Create first project',
      description: 'Give the team a place to ship work',
      to: '/app/projects',
      show: can('projects:create'),
    },
    {
      key: 'tourCompleted',
      done: onboarding.tourCompleted,
      title: 'Finish setup',
      description: 'Mark onboarding complete when ready',
      action: 'complete',
    },
  ].filter((s) => s.show !== false)

  const remaining = steps.filter((s) => !s.done).length
  if (remaining === 0 && onboarding.completedAt) return null

  const completeMutation = useMutation({
    mutationFn: () =>
      orgApi.update(org.id, {
        onboarding: {
          profileCompleted: true,
          invitedMembers: onboarding.invitedMembers,
          createdProject: onboarding.createdProject,
          tourCompleted: true,
        },
      }),
    onSuccess: async (result) => {
      dispatch(setActiveOrganization({ organization: result.organization }))
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Setup complete')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <section className="surface-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="app-title text-base">Company setup</h2>
          <p className="text-xs text-muted-foreground">
            {remaining === 0
              ? 'All steps done — mark setup complete.'
              : `${remaining} step${remaining === 1 ? '' : 's'} left to launch your workspace.`}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.key}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-2">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {!step.done && step.to ? (
              <Button asChild size="sm" variant="outline">
                <Link to={step.to}>Open</Link>
              </Button>
            ) : null}
            {!step.done && step.action === 'complete' ? (
              <Button
                size="sm"
                loading={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
              >
                Complete
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
