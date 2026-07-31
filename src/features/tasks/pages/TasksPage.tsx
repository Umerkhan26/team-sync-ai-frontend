import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Plus,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { projectApi } from '@/services/projectApi'
import { taskApi } from '@/services/taskApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { setActiveTaskId } from '@/store/uiSlice'
import { KANBAN_COLUMNS, type Task, type TaskPriority, type TaskStatus } from '@/types'
import { cn, getErrorMessage, getRelativeDueLabel, isOverdue } from '@/utils/cn'
import {
  deleteSavedView,
  listSavedViews,
  saveSavedView,
  type SavedView,
} from '@/utils/savedViews'

const schema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  projectId: z.string().min(1, 'Select a project'),
})

type FormValues = z.infer<typeof schema>
type ViewMode = 'board' | 'list' | 'calendar' | 'mine'

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateKey(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return dateKey(d)
}

function getMonthMatrix(anchor: Date) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const start = new Date(year, month, 1 - firstOfMonth.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projectFilter = searchParams.get('projectId') || ''
  const [open, setOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('board')
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const currentUserId = useAppSelector((s) => s.auth.user?.id)
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const { can } = usePermissions()

  useEffect(() => {
    if (!orgId) return
    setSavedViews(listSavedViews(orgId, 'tasks'))
  }, [orgId])

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => projectApi.list({ limit: 100 }),
    enabled: Boolean(orgId),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', orgId, projectFilter || 'all'],
    queryFn: () =>
      taskApi.list({
        limit: 100,
        projectId: projectFilter || undefined,
      }),
    enabled: Boolean(orgId),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      projectId: projectFilter || '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      taskApi.create({
        projectId: values.projectId,
        title: values.title,
        description: values.description || undefined,
        priority: values.priority as TaskPriority,
        status: 'todo',
      }),
    onSuccess: async () => {
      toast.success('Task created')
      setOpen(false)
      form.reset({
        title: '',
        description: '',
        priority: 'medium',
        projectId: projectFilter || '',
      })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const transitionMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      taskApi.transition(taskId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not move task')),
  })

  const allTasks = tasksQuery.data?.data.items ?? []
  const projects = projectsQuery.data?.data.items ?? []

  useEffect(() => {
    if (searchParams.get('open') !== '1') return
    const priority = searchParams.get('priority')
    form.reset({
      title: searchParams.get('title') || '',
      description: searchParams.get('description') || '',
      priority: (['low', 'medium', 'high', 'urgent'] as const).includes(priority as never)
        ? (priority as FormValues['priority'])
        : 'medium',
      projectId: projectFilter || projects[0]?.id || '',
    })
    setOpen(true)
    searchParams.delete('open')
    searchParams.delete('title')
    searchParams.delete('description')
    searchParams.delete('priority')
    searchParams.delete('template')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length])
  const tasks = useMemo(() => {
    let list =
      view === 'mine'
        ? allTasks.filter((t) => t.assigneeIds?.includes(currentUserId || ''))
        : allTasks
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter)
    if (priorityFilter !== 'all') list = list.filter((t) => t.priority === priorityFilter)
    return list
  }, [allTasks, view, currentUserId, statusFilter, priorityFilter])

  const columns = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const col of KANBAN_COLUMNS) map[col.id] = []
    for (const task of tasks) {
      if (map[task.status]) map[task.status]!.push(task)
    }
    return map
  }, [tasks])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const key = toDateKey(task.dueDate)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [tasks])

  const monthDays = useMemo(() => getMonthMatrix(calendarAnchor), [calendarAnchor])

  const moveTask = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    transitionMutation.mutate({ taskId, status })
  }

  const dueLabelBadge = (task: Task) => {
    const label = getRelativeDueLabel(task.dueDate)
    if (!label) return null
    const overdue = isOverdue(task.dueDate) && task.status !== 'done' && task.status !== 'cancelled'
    return (
      <span className={cn('font-medium', overdue ? 'text-destructive' : 'text-muted-foreground')}>
        {label}
      </span>
    )
  }

  const viewTabs: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'board', label: 'Board', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: ListIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'mine', label: 'My Tasks', icon: UserRound },
  ]

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Kanban board — drag cards across Todo → In Progress → In Review → Done."
        actions={
          can('tasks:create') ? (
            <Button
              size="sm"
              onClick={() => {
                form.setValue('projectId', projectFilter || projects[0]?.id || '')
                setOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New task
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label className="text-muted-foreground">Project</Label>
        <Select
          value={projectFilter || 'all'}
          onValueChange={(value) => {
            if (value === 'all') {
              searchParams.delete('projectId')
            } else {
              searchParams.set('projectId', value)
            }
            setSearchParams(searchParams)
          }}
        >
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {KANBAN_COLUMNS.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {orgId ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                const name = window.prompt('Name this view')
                if (!name?.trim()) return
                const next = saveSavedView(orgId, 'tasks', name, {
                  projectId: projectFilter || 'all',
                  status: statusFilter,
                  priority: priorityFilter,
                  view,
                })
                setSavedViews(next)
                toast.success('View saved')
              }}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Save view
            </Button>
            {savedViews.map((saved) => (
              <Button
                key={saved.id}
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                onClick={() => {
                  const projectId = saved.filters.projectId || 'all'
                  if (projectId === 'all') searchParams.delete('projectId')
                  else searchParams.set('projectId', projectId)
                  setSearchParams(searchParams)
                  setStatusFilter(saved.filters.status || 'all')
                  setPriorityFilter(saved.filters.priority || 'all')
                  if (saved.filters.view) setView(saved.filters.view as ViewMode)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (!window.confirm(`Delete saved view “${saved.name}”?`)) return
                  setSavedViews(deleteSavedView(orgId, 'tasks', saved.id))
                }}
                title="Right-click to delete"
              >
                {saved.name}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {viewTabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={view === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setView(tab.id)}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {!orgId ? (
        <EmptyState title="Select an organization" description="Choose a workspace to view its tasks." />
      ) : tasksQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : tasksQuery.isError ? (
        <ErrorState onRetry={() => void tasksQuery.refetch()} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Create a project first"
          description="Tasks belong to a project."
          actionLabel="Go to projects"
          onAction={() => {
            window.location.href = '/app/projects'
          }}
        />
      ) : view === 'list' || view === 'mine' ? (
        tasks.length === 0 ? (
          <EmptyState
            title={view === 'mine' ? 'No tasks assigned to you' : 'No tasks found'}
            description="Try a different project or filter."
          />
        ) : (
          <ul className="surface-panel divide-y divide-border overflow-hidden">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40"
                onClick={() => dispatch(setActiveTaskId(task.id))}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-mono">#{task.number}</span> · {task.priority}
                    {task.dueDate ? (
                      <>
                        {' · '}
                        {dueLabelBadge(task)}
                      </>
                    ) : null}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {task.status.replaceAll('_', ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        )
      ) : view === 'calendar' ? (
        <div className="surface-panel p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setCalendarAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
              }
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="app-title text-sm">
              {calendarAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setCalendarAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
              }
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const key = dateKey(day)
              const dayTasks = tasksByDate.get(key) || []
              const inMonth = day.getMonth() === calendarAnchor.getMonth()
              const isToday = key === dateKey(new Date())
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[92px] rounded-md border border-border/70 p-1.5 text-left align-top',
                    !inMonth && 'bg-muted/30 opacity-50',
                    isToday && 'border-primary/60 bg-primary/5',
                  )}
                >
                  <p className={cn('mb-1 text-[11px] font-medium', isToday && 'text-primary')}>
                    {day.getDate()}
                  </p>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => dispatch(setActiveTaskId(task.id))}
                        className={cn(
                          'block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium',
                          task.status === 'done'
                            ? 'bg-success/15 text-success'
                            : isOverdue(task.dueDate)
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-primary/10 text-primary',
                        )}
                        title={task.title}
                      >
                        {task.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 ? (
                      <p className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((column) => (
            <section
              key={column.id}
              className={cn(
                'flex flex-col rounded-xl border border-border bg-muted/30 p-2.5 transition-colors',
                draggingId && can('tasks:update') && 'border-dashed border-primary/40 bg-primary/5',
              )}
              onDragOver={(e) => {
                if (can('tasks:update')) e.preventDefault()
              }}
              onDrop={() => {
                if (!can('tasks:update')) return
                if (draggingId) moveTask(draggingId, column.id)
                setDraggingId(null)
              }}
            >
              <div className="mb-2.5 flex items-center justify-between px-1.5">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      column.id === 'done' && 'bg-success',
                      column.id === 'in_review' && 'bg-warning',
                      column.id === 'in_progress' && 'bg-info',
                      column.id === 'todo' && 'bg-muted-foreground/50',
                    )}
                  />
                  {column.label}
                </h2>
                <Badge variant="secondary" className="tabular-nums">
                  {columns[column.id]?.length ?? 0}
                </Badge>
              </div>
              <div className="min-h-[120px] flex-1 space-y-2">
                {(columns[column.id] ?? []).length === 0 ? (
                  <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-border/70 px-2 py-8 text-center text-xs text-muted-foreground">
                    No tasks
                  </div>
                ) : (
                  (columns[column.id] ?? []).map((task) => (
                    <article
                      key={task.id}
                      draggable={can('tasks:update')}
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => dispatch(setActiveTaskId(task.id))}
                      className={cn(
                        'group rounded-lg border border-border bg-card p-2.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
                        can('tasks:update') && 'cursor-grab active:cursor-grabbing',
                        draggingId === task.id && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-snug">{task.title}</p>
                        <span
                          className={cn(
                            'mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            task.priority === 'urgent' && 'bg-destructive',
                            task.priority === 'high' && 'bg-warning',
                            task.priority === 'medium' && 'bg-info',
                            task.priority === 'low' && 'bg-muted-foreground/50',
                          )}
                          title={`${task.priority} priority`}
                        />
                      </div>
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="font-mono">#{task.number}</span>
                        <span className="capitalize">· {task.priority}</span>
                        {task.dueDate ? (
                          <>
                            {' · '}
                            {dueLabelBadge(task)}
                          </>
                        ) : null}
                      </p>
                      {can('tasks:update') ? (
                        <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {KANBAN_COLUMNS.filter((c) => c.id !== task.status).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-accent"
                              onClick={(e) => {
                                e.stopPropagation()
                                moveTask(task.id, c.id)
                              }}
                            >
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={form.watch('projectId')}
                onValueChange={(value) => form.setValue('projectId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.projectId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.projectId.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register('title')} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(value) =>
                  form.setValue('priority', value as FormValues['priority'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'urgent'].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...form.register('description')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
