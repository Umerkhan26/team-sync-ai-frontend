import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  FolderKanban,
  ListTodo,
  MessageSquare,
  Plus,
  Shield,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SetupChecklist } from '@/features/organizations/components/SetupChecklist'
import { analyticsApi, fileApi } from '@/services/fileApi'
import { projectApi } from '@/services/projectApi'
import { taskApi } from '@/services/taskApi'
import { orgApi } from '@/services/orgApi'
import { meetingApi } from '@/services/meetingApi'
import { auditApi } from '@/services/auditApi'
import { documentApi } from '@/services/documentApi'
import { teamApi } from '@/services/teamApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, formatDate, formatDateTime, getInitials } from '@/utils/cn'
import type { Task, User } from '@/types'

function isOverdue(task: Task) {
  if (!task.dueDate) return false
  if (task.status === 'done' || task.status === 'cancelled') return false
  const due = new Date(task.dueDate)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return due < start
}

function isDueToday(task: Task) {
  if (!task.dueDate) return false
  if (task.status === 'done' || task.status === 'cancelled') return false
  const due = new Date(task.dueDate)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return due >= start && due <= end
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function startOfDay(d: Date) {
  const next = new Date(d)
  next.setHours(0, 0, 0, 0)
  return next
}

/** Last 7 days (inclusive of today) with completed-task counts for the week chart. */
function buildWeekCompletions(tasks: Task[]) {
  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - i))
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
      count: 0,
      time: date.getTime(),
    }
  })
  for (const task of tasks) {
    if (task.status !== 'done') continue
    const raw = task.completedAt || task.updatedAt
    if (!raw) continue
    const completed = startOfDay(new Date(raw)).getTime()
    const day = days.find((d) => d.time === completed)
    if (day) day.count += 1
  }
  const max = Math.max(1, ...days.map((d) => d.count))
  return { days, max }
}

const STATUS_ORDER = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
] as const

export function DashboardPage() {
  const [params] = useSearchParams()
  const showSetup = params.get('setup') === '1'
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const org = useAppSelector((s) => s.org.activeOrganization)
  const user = useAppSelector((s) => s.auth.user)
  const { can, isGuest, isOwner, isAdmin, roleSlug, roleName } = usePermissions()

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', orgId],
    queryFn: () => analyticsApi.overview(),
    enabled: Boolean(orgId) && can('analytics:read'),
  })

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId, 'home'],
    queryFn: () => projectApi.list({ limit: 6 }),
    enabled: Boolean(orgId),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', orgId, 'home'],
    queryFn: () => taskApi.list({ limit: 50 }),
    enabled: Boolean(orgId),
  })

  const invitesQuery = useQuery({
    queryKey: ['invitations', orgId, 'home'],
    queryFn: () => orgApi.listInvitations(orgId!),
    enabled: Boolean(orgId) && can('members:invite'),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId, 'home'],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(orgId) && can('members:read'),
  })

  const meetingsQuery = useQuery({
    queryKey: ['meetings', orgId, 'home'],
    queryFn: () => meetingApi.list({ limit: 20 }),
    enabled: Boolean(orgId) && can('meetings:read'),
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', orgId, 'home'],
    queryFn: () => auditApi.list({ limit: 6 }),
    enabled: Boolean(orgId) && can('audit:read'),
  })

  const docsQuery = useQuery({
    queryKey: ['documents', orgId, 'home'],
    queryFn: () => documentApi.list({ limit: 5 }),
    enabled: Boolean(orgId) && can('documents:read'),
  })

  const teamsQuery = useQuery({
    queryKey: ['teams', orgId, 'home'],
    queryFn: () => teamApi.list({ limit: 6 }),
    enabled: Boolean(orgId) && can('teams:read'),
  })

  const filesQuery = useQuery({
    queryKey: ['files', orgId, 'home'],
    queryFn: () => fileApi.list({ limit: 5 }),
    enabled: Boolean(orgId) && can('files:read'),
  })

  if (!orgId) {
    return (
      <EmptyState
        title="No workspace selected"
        description="Create or select a company workspace to continue."
        actionLabel="Create company"
        onAction={() => {
          window.location.href = '/onboarding'
        }}
      />
    )
  }

  if (
    projectsQuery.isLoading ||
    tasksQuery.isLoading ||
    (can('analytics:read') && overviewQuery.isLoading)
  ) {
    return <LoadingState variant="page" rows={5} />
  }

  const overview = overviewQuery.data
  const projects = projectsQuery.data?.data.items ?? []
  const tasks = tasksQuery.data?.data.items ?? []
  const myTasks = tasks.filter((t) => t.assigneeIds?.includes(user?.id || ''))
  const dueToday = tasks.filter(isDueToday)
  const overdue = tasks.filter(isOverdue)
  const pendingInvites =
    invitesQuery.data?.filter((i) => i.status === 'pending').length ?? 0
  const upcomingMeetings = (meetingsQuery.data?.data.items ?? [])
    .filter((m) => new Date(m.endsAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 4)
  const members = membersQuery.data ?? []
  const docs = docsQuery.data?.data.items ?? []
  const teams = teamsQuery.data?.data.items ?? []
  const recentFiles = filesQuery.data?.data.items ?? []

  const focusPool = roleSlug === 'member' || roleSlug === 'guest' ? myTasks : tasks
  const focusForToday = focusPool
    .filter((t) => isDueToday(t) || isOverdue(t))
    .sort((a, b) => {
      const aOver = isOverdue(a) ? 0 : 1
      const bOver = isOverdue(b) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      return aDue - bDue
    })
    .slice(0, 5)
  const focusTasks = focusPool
    .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => {
      const aOver = isOverdue(a) ? 0 : 1
      const bOver = isOverdue(b) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      return aDue - bDue
    })
    .slice(0, 8)

  const weekChart = buildWeekCompletions(
    roleSlug === 'member' || roleSlug === 'guest' ? myTasks : tasks,
  )

  const statusSource =
    roleSlug === 'member' || roleSlug === 'guest' ? myTasks : tasks
  const statusCounts = STATUS_ORDER.map((col) => ({
    ...col,
    count: statusSource.filter((t) => t.status === col.id).length,
  }))
  const statusTotal = Math.max(
    1,
    statusCounts.reduce((sum, s) => sum + s.count, 0),
  )
  const donePct = Math.round(((statusCounts.find((s) => s.id === 'done')?.count || 0) / statusTotal) * 100)

  const ownerStats = [
    {
      label: 'Users',
      value: overview?.members ?? members.length,
      icon: Users,
      hint: 'Active memberships',
    },
    {
      label: 'Projects',
      value: overview?.projects ?? projects.length,
      icon: FolderKanban,
      hint: 'Across the workspace',
    },
    {
      label: 'Open tasks',
      value: overview?.openTasks ?? tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
      icon: ListTodo,
      hint: 'Not done / cancelled',
    },
    {
      label: 'AI requests',
      value: overview?.ai.requests ?? 0,
      icon: Sparkles,
      hint: 'This billing period',
    },
  ]

  const managerStats = [
    {
      label: 'Due today',
      value: overview?.dueToday ?? dueToday.length,
      icon: CalendarClock,
      hint: 'Needs attention today',
    },
    {
      label: 'Overdue',
      value: overview?.overdue ?? overdue.length,
      icon: AlertTriangle,
      hint: 'Past due date',
    },
    {
      label: 'Open tasks',
      value: overview?.openTasks ?? 0,
      icon: ListTodo,
      hint: 'Team backlog',
    },
    {
      label: 'Projects',
      value: projects.length,
      icon: FolderKanban,
      hint: 'Active portfolio',
    },
  ]

  const memberStats = [
    {
      label: 'My open',
      value: myTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
      icon: ListTodo,
      hint: 'Assigned to you',
    },
    {
      label: 'Due today',
      value: myTasks.filter(isDueToday).length,
      icon: CalendarClock,
      hint: 'Finish before EOD',
    },
    {
      label: 'Overdue',
      value: myTasks.filter(isOverdue).length,
      icon: AlertTriangle,
      hint: 'Catch up first',
    },
    {
      label: 'Projects',
      value: projects.length,
      icon: FolderKanban,
      hint: 'You can access',
    },
  ]

  const stats =
    isOwner || isAdmin
      ? ownerStats
      : roleSlug === 'manager'
        ? managerStats
        : memberStats

  const title =
    isOwner
      ? 'Company overview'
      : isAdmin
        ? 'Operations'
        : roleSlug === 'manager'
          ? 'Team delivery'
          : 'My workspace'

  const quickActions = [
    can('tasks:create')
      ? { to: '/app/tasks', label: 'New task', icon: ListTodo }
      : null,
    can('projects:create')
      ? { to: '/app/projects', label: 'New project', icon: FolderKanban }
      : null,
    can('channels:read')
      ? { to: '/app/chat', label: 'Open chat', icon: MessageSquare }
      : null,
    can('documents:create')
      ? { to: '/app/documents', label: 'New doc', icon: FileText }
      : null,
    can('meetings:create')
      ? { to: '/app/meetings', label: 'Schedule', icon: CalendarClock }
      : null,
    can('members:invite')
      ? { to: '/app/admin', label: 'Invite people', icon: Users }
      : null,
  ].filter(Boolean) as { to: string; label: string; icon: typeof ListTodo }[]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Overview"
        title={
          isGuest
            ? `Welcome, ${user?.name?.split(' ')[0] || 'guest'}`
            : `Good ${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`
        }
        description={
          isGuest
            ? `${org?.name} · Guest access to shared work only.`
            : `${org?.name} · ${title} as ${roleName}.`
        }
        actions={
          can('projects:create') ? (
            <Button asChild size="sm">
              <Link to="/app/projects">
                <Plus className="h-3.5 w-3.5" />
                New project
              </Link>
            </Button>
          ) : can('tasks:create') ? (
            <Button asChild size="sm">
              <Link to="/app/tasks">
                <Plus className="h-3.5 w-3.5" />
                New task
              </Link>
            </Button>
          ) : null
        }
      />

      {(showSetup || isOwner || isAdmin) && !org?.onboarding?.completedAt ? (
        <SetupChecklist />
      ) : null}

      {quickActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button key={action.to} asChild variant="secondary" size="sm" className="h-8">
              <Link to={action.to}>
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="surface-panel group relative overflow-hidden p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/10 transition-transform duration-200 group-hover:scale-125"
            />
            <div className="relative flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                <stat.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="relative mt-2 text-[1.7rem] font-semibold leading-none tracking-tight">
              {stat.value}
            </p>
            <p className="relative mt-1.5 text-[11px] text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="app-title text-base">Focus for today</h2>
              <p className="text-[11px] text-muted-foreground">
                Due today and overdue · max 5
              </p>
            </div>
            <Link to="/app/tasks" className="text-xs font-medium text-primary hover:underline">
              All tasks
            </Link>
          </div>
          {focusForToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing due today or overdue. You&apos;re clear for now.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border/60">
              {focusForToday.map((task, index) => (
                <li
                  key={task.id || `focus-${task.number ?? index}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-mono">#{task.number}</span>
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                      {isOverdue(task) ? (
                        <span className="font-medium text-destructive"> · overdue</span>
                      ) : (
                        <span className="font-medium text-warning"> · today</span>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={isOverdue(task) ? 'destructive' : 'outline'}
                    className="shrink-0 capitalize"
                  >
                    {task.status.replaceAll('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="app-title text-base">This week</h2>
              <p className="text-[11px] text-muted-foreground">
                Completed tasks · last 7 days
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {weekChart.days.reduce((sum, d) => sum + d.count, 0)} done
            </Badge>
          </div>
          <div className="ts-week-chart" aria-hidden={weekChart.days.every((d) => d.count === 0)}>
            {weekChart.days.map((day) => (
              <span
                key={day.key}
                title={`${day.label}: ${day.count}`}
                style={{
                  height: `${Math.max(4, Math.round((day.count / weekChart.max) * 100))}%`,
                  opacity: day.count === 0 ? 0.25 : 0.85,
                }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-[0.35rem] text-center text-[10px] text-muted-foreground">
            {weekChart.days.map((day) => (
              <span key={`${day.key}-label`} className="tabular-nums">
                {day.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      {can('files:read') ? (
        <section className="surface-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="app-title text-base">Recent files</h2>
              <p className="text-[11px] text-muted-foreground">Latest uploads in this workspace</p>
            </div>
            <Link to="/app/files" className="text-xs font-medium text-primary hover:underline">
              All files
            </Link>
          </div>
          {filesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading files…</p>
          ) : recentFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border/60">
              {recentFiles.map((file, index) => (
                <li key={file.id || `${file.fileName}-${index}`}>
                  <a
                    href={file.secureUrl || file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{file.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {file.createdAt ? formatDate(file.createdAt) : '—'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      File
                    </Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="app-title text-base">Delivery pulse</h2>
              <p className="text-[11px] text-muted-foreground">
                {roleSlug === 'member' || isGuest ? 'Your task mix' : 'Workspace task mix'} · {donePct}% done
              </p>
            </div>
            <Link to="/app/tasks" className="text-xs font-medium text-primary hover:underline">
              Board
            </Link>
          </div>
          <div className="space-y-3">
            {statusCounts.map((row) => (
              <div key={row.id}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums font-medium">{row.count}</span>
                </div>
                <div className="stat-bar">
                  <span style={{ width: `${Math.round((row.count / statusTotal) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {can('members:read') ? (
          <section className="surface-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="app-title text-base">Team</h2>
                <p className="text-[11px] text-muted-foreground">
                  {members.length} member{members.length === 1 ? '' : 's'} in this workspace
                </p>
              </div>
              {(isOwner || isAdmin) && can('members:invite') ? (
                <Link to="/app/admin" className="text-xs font-medium text-primary hover:underline">
                  Manage
                </Link>
              ) : null}
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members loaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.slice(0, 6).map((membership) => {
                  const person =
                    typeof membership.userId === 'object' && membership.userId
                      ? (membership.userId as User)
                      : null
                  const name = person?.name || 'Member'
                  return (
                    <li key={membership.id || person?.id || person?.email || name} className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person?.avatarUrl || undefined} alt="" />
                        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {person?.email || '—'}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {typeof membership.roleId === 'object' && membership.roleId
                          ? (membership.roleId as { name?: string }).name || 'Role'
                          : 'Member'}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="surface-panel p-4">
            <h2 className="app-title mb-1 text-base">Focus tip</h2>
            <p className="text-sm text-muted-foreground">
              Start with overdue items, then due today. Use Chat threads for decisions and Docs for
              lasting context.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link to="/app/tasks">My tasks</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/app/chat">Chat</Link>
              </Button>
            </div>
          </section>
        )}
      </div>

      {(isOwner || isAdmin) && can('members:invite') ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="surface-panel p-4 md:col-span-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Shield className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-medium">Pending invitations</p>
            </div>
            <p className="text-2xl font-semibold tracking-tight">{pendingInvites}</p>
            <Button asChild variant="link" className="mt-1 h-auto px-0 text-xs">
              <Link to="/app/admin">Manage members</Link>
            </Button>
          </div>
          <div className="surface-panel p-4 md:col-span-2">
            <p className="text-sm font-medium">Security & governance</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Roles, invites, and audit logs are live. SSO and billing stay on the enterprise
              roadmap.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="success">RBAC live</Badge>
              <Badge variant="outline">Audit live</Badge>
              <Badge variant="outline">SSO soon</Badge>
              <Badge variant="outline">Billing soon</Badge>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="app-title text-base">
              {roleSlug === 'member' || isGuest ? 'My work' : 'Work needing attention'}
            </h2>
            <Link to="/app/tasks" className="text-xs font-medium text-primary hover:underline">
              Open board
            </Link>
          </div>
          {tasksQuery.isError ? (
            <ErrorState onRetry={() => void tasksQuery.refetch()} />
          ) : focusTasks.length === 0 ? (
            <EmptyState
              title="Nothing on your plate"
              description="Assigned and open tasks appear here so you can start focused."
            />
          ) : (
            <ul className="surface-panel divide-y divide-border overflow-hidden">
              {focusTasks.map((task, index) => (
                <li
                  key={task.id || `task-${task.number ?? index}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-mono">#{task.number}</span>
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                      {isOverdue(task) ? (
                        <span className="font-medium text-destructive"> · overdue</span>
                      ) : isDueToday(task) ? (
                        <span className="font-medium text-warning"> · today</span>
                      ) : (
                        ''
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {task.status.replaceAll('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {can('documents:read') ? (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="app-title text-base">Recent docs</h2>
                <Link to="/app/documents" className="text-xs font-medium text-primary hover:underline">
                  All docs
                </Link>
              </div>
              {docs.length === 0 ? (
                <div className="surface-panel p-4 text-sm text-muted-foreground">
                  No documents yet. Capture decisions and specs here.
                </div>
              ) : (
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {docs.map((doc, index) => (
                    <li key={doc.id || `doc-${index}`}>
                      <Link
                        to={`/app/documents/${doc.id}`}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <FileText className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Updated {formatDate(doc.updatedAt || doc.createdAt)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="app-title text-base">Projects</h2>
            <Link to="/app/projects" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description={
                can('projects:create')
                  ? 'Create a project to organize tasks, docs, and chat.'
                  : 'Ask an admin to add you to a project.'
              }
              actionLabel={can('projects:create') ? 'Create project' : undefined}
              onAction={
                can('projects:create')
                  ? () => {
                      window.location.href = '/app/projects'
                    }
                  : undefined
              }
            />
          ) : (
            <ul className="surface-panel divide-y divide-border overflow-hidden">
              {projects.map((project, index) => {
                const projectTasks = tasks.filter((t) => t.projectId === project.id)
                const open = projectTasks.filter(
                  (t) => t.status !== 'done' && t.status !== 'cancelled',
                ).length
                const done = projectTasks.filter((t) => t.status === 'done').length
                const total = Math.max(1, open + done)
                return (
                  <li key={project.id || `project-${index}`}>
                    <Link
                      to={`/app/projects/${project.id}`}
                      className={cn(
                        'block px-3.5 py-2.5 transition-colors hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{project.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {project.key} · {open} open · {formatDate(project.updatedAt)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="capitalize">
                          {project.status}
                        </Badge>
                      </div>
                      <div className="stat-bar mt-2">
                        <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {can('teams:read') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="app-title text-base">Teams</h2>
                <Link to="/app/teams" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              {teams.length === 0 ? (
                <div className="surface-panel p-4 text-sm text-muted-foreground">
                  No teams yet. Group people for ownership and delivery.
                </div>
              ) : (
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {teams.slice(0, 4).map((team, index) => (
                    <li
                      key={team.id || `team-${index}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info/15 text-info">
                          <UsersRound className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{team.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {team.memberIds?.length ?? 0} members
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {can('meetings:read') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="app-title text-base">Upcoming meetings</h2>
                <Link to="/app/meetings" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              {upcomingMeetings.length === 0 ? (
                <div className="surface-panel p-4 text-sm text-muted-foreground">
                  No upcoming meetings scheduled.
                </div>
              ) : (
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {upcomingMeetings.map((meeting, index) => (
                    <li
                      key={meeting.id || `meeting-${index}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{meeting.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(meeting.startsAt)}
                        </p>
                      </div>
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {can('audit:read') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="app-title text-base">Recent activity</h2>
                <Link to="/app/admin" className="text-xs font-medium text-primary hover:underline">
                  Full log
                </Link>
              </div>
              {(auditQuery.data?.data.items.length || 0) === 0 ? (
                <div className="surface-panel p-4 text-sm text-muted-foreground">
                  No audit activity yet.
                </div>
              ) : (
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {auditQuery.data!.data.items.map((log, index) => (
                    <li
                      key={log.id || `${log.action}-${log.createdAt}-${index}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {log.action}
                          <span className="ml-1 font-normal text-muted-foreground">
                            · {log.resource}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {typeof log.actorId === 'object' && log.actorId
                            ? (log.actorId as User).name
                            : 'System'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {can('ai:use') ? (
            <div className="surface-panel relative flex items-start gap-3 overflow-hidden p-4">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/15"
              />
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="relative min-w-0">
                <p className="text-sm font-medium">AI assistant</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Draft tasks, summarize threads, or sketch a sprint — from the top bar (⌘J).
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
