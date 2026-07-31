import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, LayoutGrid, List as ListIcon, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { projectApi } from '@/services/projectApi'
import { orgApi } from '@/services/orgApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, formatDate, getErrorMessage, getInitials } from '@/utils/cn'
import type { Membership, Project, ProjectStatus, User } from '@/types'

const schema = z.object({
  name: z.string().min(1).max(120),
  key: z.string().max(10).optional().or(z.literal('')),
  description: z.string().max(5000).optional().or(z.literal('')),
  memberIds: z.array(z.string()),
})

function memberUser(membership: Membership): User | null {
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

function statusPillVariant(status: ProjectStatus) {
  if (status === 'active') return 'success' as const
  if (status === 'completed') return 'secondary' as const
  return 'outline' as const
}

type FormValues = z.infer<typeof schema>

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'board'>('board')
  const [showArchived, setShowArchived] = useState(false)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const query = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => projectApi.list({ limit: 50 }),
    enabled: Boolean(orgId),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(orgId) && open,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', key: '', description: '', memberIds: [] },
  })

  useEffect(() => {
    if (searchParams.get('open') !== '1') return
    form.reset({
      name: searchParams.get('name') || '',
      key: '',
      description: searchParams.get('description') || '',
      memberIds: [],
    })
    setOpen(true)
    searchParams.delete('open')
    searchParams.delete('name')
    searchParams.delete('description')
    searchParams.delete('template')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      projectApi.create({
        name: values.name,
        key: values.key || undefined,
        description: values.description || undefined,
        memberIds: values.memberIds,
      }),
    onSuccess: async () => {
      toast.success('Project created')
      setOpen(false)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) =>
      projectApi.update(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update project')),
  })

  const archiveProject = (project: Project) => {
    statusMutation.mutate(
      { id: project.id, status: 'archived' },
      {
        onSuccess: () => {
          toast.success(`"${project.name}" archived`, {
            action: {
              label: 'Undo',
              onClick: () => statusMutation.mutate({ id: project.id, status: 'active' }),
            },
          })
        },
      },
    )
  }

  const toggleMember = (userId: string) => {
    const current = form.getValues('memberIds')
    form.setValue(
      'memberIds',
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  const allProjects = query.data?.data.items ?? []
  const projects = useMemo(
    () => (showArchived ? allProjects : allProjects.filter((p) => p.status !== 'archived')),
    [allProjects, showArchived],
  )
  const canManage = can('projects:update')

  const renderCard = (project: Project) => (
    <div
      key={project.id}
      className="surface-panel group relative p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <Link to={`/app/projects/${project.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-title truncate text-base">{project.name}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {project.key}
            </p>
          </div>
          <Badge variant={statusPillVariant(project.status)} className="shrink-0 gap-1 capitalize">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                project.status === 'active' && 'bg-success',
                project.status === 'completed' && 'bg-muted-foreground',
                project.status === 'archived' && 'bg-muted-foreground',
              )}
            />
            {project.status}
          </Badge>
        </div>
        {project.description ? (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        ) : (
          <p className="mt-3 text-sm italic text-muted-foreground/60">No description yet</p>
        )}
        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Updated {formatDate(project.updatedAt)}
        </p>
      </Link>
      {canManage ? (
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
          {project.status === 'archived' ? (
            <Button
              variant="secondary"
              size="icon-sm"
              title="Restore project"
              onClick={() => statusMutation.mutate({ id: project.id, status: 'active' })}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="icon-sm"
              title="Archive project"
              onClick={() => archiveProject(project)}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )

  const renderRow = (project: Project) => (
    <li
      key={project.id}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
    >
      <Link to={`/app/projects/${project.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <Badge variant={statusPillVariant(project.status)} className="shrink-0 capitalize">
            {project.status}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {project.key} {project.description ? `· ${project.description}` : ''}
        </p>
      </Link>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        Updated {formatDate(project.updatedAt)}
      </span>
      {canManage ? (
        project.status === 'archived' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Restore project"
            onClick={() => statusMutation.mutate({ id: project.id, status: 'active' })}
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Archive project"
            onClick={() => archiveProject(project)}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )
      ) : null}
    </li>
  )

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Organize delivery streams for your organization."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
              <Button
                type="button"
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setView('list')}
                aria-label="List view"
              >
                <ListIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setView('board')}
                aria-label="Board view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          </div>
        }
      />

      {allProjects.some((p) => p.status === 'archived') ? (
        <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <Checkbox checked={showArchived} onCheckedChange={(c) => setShowArchived(Boolean(c))} />
          Show archived
        </label>
      ) : null}

      {!orgId ? (
        <EmptyState title="Select an organization" description="Choose an org to list projects." />
      ) : query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects"
          description="Create your first project to start assigning tasks."
          actionLabel="Create project"
          onAction={() => setOpen(true)}
        />
      ) : view === 'board' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{projects.map(renderCard)}</div>
      ) : (
        <ul className="surface-panel divide-y divide-border overflow-hidden">
          {projects.map(renderRow)}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Set up a new delivery stream and add teammates to start assigning tasks.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoFocus {...form.register('name')} placeholder="Website relaunch" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input id="key" {...form.register('key')} placeholder="ACME" className="uppercase" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...form.register('description')} placeholder="What is this project about? (optional)" />
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
                {(membersQuery.data || []).length === 0 ? (
                  <p className="px-1 py-1 text-xs text-muted-foreground">No members to add yet.</p>
                ) : (
                  membersQuery.data!.map((m) => {
                    const user = memberUser(m)
                    if (!user) return null
                    const checked = form.watch('memberIds').includes(user.id)
                    return (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm transition-colors hover:bg-accent"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleMember(user.id)} />
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-medium">
                          {getInitials(user.name || user.email)}
                        </span>
                        <span className="truncate">{user.name || user.email}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
