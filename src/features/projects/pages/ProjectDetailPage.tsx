import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  ListTodo,
  MessageSquare,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageLoading } from '@/components/shared/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { projectApi } from '@/services/projectApi'
import { taskApi } from '@/services/taskApi'
import { documentApi } from '@/services/documentApi'
import { channelApi } from '@/services/channelApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { setActiveTaskId } from '@/store/uiSlice'
import { cn, formatDate, isOverdue as dueIsOverdue } from '@/utils/cn'
import type { Task, TaskStatus } from '@/types'

const STATUS_META: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
]

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const dispatch = useAppDispatch()
  const { can } = usePermissions()

  const projectQuery = useQuery({
    queryKey: ['projects', orgId, projectId],
    queryFn: () => projectApi.get(projectId),
    enabled: Boolean(orgId && projectId),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', orgId, projectId],
    queryFn: () => taskApi.list({ projectId, limit: 100 }),
    enabled: Boolean(orgId && projectId),
  })

  const docsQuery = useQuery({
    queryKey: ['documents', orgId, 'project', projectId],
    queryFn: () => documentApi.list({ projectId, limit: 8 }),
    enabled: Boolean(orgId && projectId) && can('documents:read'),
  })

  const channelsQuery = useQuery({
    queryKey: ['channels', orgId, 'project', projectId],
    queryFn: () => channelApi.list({ projectId, limit: 10 }),
    enabled: Boolean(orgId && projectId) && can('channels:read'),
  })

  if (projectQuery.isLoading) return <PageLoading />
  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        title="Project not found"
        onRetry={() => void projectQuery.refetch()}
      />
    )
  }

  const project = projectQuery.data
  const tasks = tasksQuery.data?.data.items ?? []
  const docs = docsQuery.data?.data.items ?? []
  const channels = channelsQuery.data?.data.items ?? []

  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const overdueTasks = openTasks.filter((t) => dueIsOverdue(t.dueDate))
  const totalForProgress = Math.max(1, openTasks.length + doneTasks.length)
  const donePct = Math.round((doneTasks.length / totalForProgress) * 100)

  const byStatus = STATUS_META.map((col) => ({
    ...col,
    count: tasks.filter((t) => t.status === col.id).length,
  }))
  const statusMax = Math.max(1, ...byStatus.map((s) => s.count))

  const priorityRank = (t: Task) => {
    const map = { urgent: 0, high: 1, medium: 2, low: 3 }
    return map[t.priority] ?? 4
  }

  const focusTasks = [...openTasks]
    .sort((a, b) => {
      const aOver = dueIsOverdue(a.dueDate) ? 0 : 1
      const bOver = dueIsOverdue(b.dueDate) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      if (priorityRank(a) !== priorityRank(b)) return priorityRank(a) - priorityRank(b)
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      return aDue - bDue
    })
    .slice(0, 12)

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={
          project.description ||
          `${project.key} · ${project.status} · updated ${formatDate(project.updatedAt)}`
        }
        actions={
          <>
            <Badge variant="secondary" className="capitalize">
              {project.status}
            </Badge>
            <Button asChild variant="secondary" size="sm">
              <Link to={`/app/tasks?projectId=${project.id}`}>
                <ListTodo className="h-3.5 w-3.5" />
                Open board
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-panel p-4">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{donePct}%</p>
          <div className="stat-bar mt-2">
            <span style={{ width: `${donePct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {doneTasks.length} done · {openTasks.length} open
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold tracking-tight',
              overdueTasks.length > 0 && 'text-destructive',
            )}
          >
            {overdueTasks.length}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Past due, still open
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs text-muted-foreground">Members</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {project.memberIds?.length ?? 0}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            On this project
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs text-muted-foreground">Key</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight">{project.key}</p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Updated {formatDate(project.updatedAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="app-title text-base">Priority work</h2>
            <Link
              to={`/app/tasks?projectId=${project.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Full board
            </Link>
          </div>
          {tasksQuery.isLoading ? (
            <PageLoading />
          ) : tasksQuery.isError ? (
            <ErrorState onRetry={() => void tasksQuery.refetch()} />
          ) : focusTasks.length === 0 ? (
            <EmptyState
              title="No open tasks"
              description="Create tasks from the board view to track delivery."
              actionLabel="Go to board"
              onAction={() => {
                window.location.href = `/app/tasks?projectId=${project.id}`
              }}
            />
          ) : (
            <ul className="surface-panel divide-y divide-border overflow-hidden">
              {focusTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => dispatch(setActiveTaskId(task.id))}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <span className="mr-1.5 font-mono text-muted-foreground">
                          {project.key}-{task.number}
                        </span>
                        {task.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.priority}
                        {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                        {dueIsOverdue(task.dueDate) ? (
                          <span className="font-medium text-destructive"> · overdue</span>
                        ) : null}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {task.status.replaceAll('_', ' ')}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="surface-panel p-4">
            <h2 className="app-title mb-3 text-base">Status mix</h2>
            <div className="space-y-2.5">
              {byStatus.map((row) => (
                <div key={row.id}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="tabular-nums font-medium">{row.count}</span>
                  </div>
                  <div className="stat-bar">
                    <span style={{ width: `${Math.round((row.count / statusMax) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {can('documents:read') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="app-title text-base">Project docs</h2>
                <Link to="/app/docs" className="text-xs font-medium text-primary hover:underline">
                  All docs
                </Link>
              </div>
              {docs.length === 0 ? (
                <div className="surface-panel p-4 text-sm text-muted-foreground">
                  No docs linked to this project yet.
                </div>
              ) : (
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {docs.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        to={`/app/docs/${doc.id}`}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium">{doc.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {can('channels:read') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="app-title text-base">Channels</h2>
                <Link to="/app/chat" className="text-xs font-medium text-primary hover:underline">
                  Chat
                </Link>
              </div>
              {channels.length === 0 ? (
                <div className="surface-panel p-4 text-sm text-muted-foreground">
                  No project channels yet.
                </div>
              ) : (
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {channels.map((ch) => (
                    <li key={ch.id}>
                      <Link
                        to={`/app/chat?channelId=${ch.id}`}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium">#{ch.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
