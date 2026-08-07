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
  Clock,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Rows3,
  GanttChart,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
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
import { orgApi } from '@/services/orgApi'
import { projectApi } from '@/services/projectApi'
import { taskApi } from '@/services/taskApi'
import { teamApi } from '@/services/teamApi'
import { getAssigneeLanes, taskInAssigneeLane } from '@/features/tasks/utils/assigneeLanes'
import { averageCycleTimeMs, formatCycleTime } from '@/features/tasks/utils/cycleTime'
import {
  isOverWipLimit,
  mergeWipLimits,
  type WipLimits,
} from '@/features/tasks/utils/wipLimits'
import { useAppDispatch, useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { setActiveOrganization } from '@/store/orgSlice'
import { setActiveTaskId } from '@/store/uiSlice'
import { KANBAN_COLUMNS, type Membership, type Task, type TaskCustomField, type TaskPriority, type TaskStatus, type User } from '@/types'
import { cn, getErrorMessage, getInitials, getRelativeDueLabel, isOverdue } from '@/utils/cn'
import type { SavedView } from '@/utils/savedViews'
import { savedViewApi } from '@/services/savedViewApi'

const schema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  projectId: z.string().min(1, 'Select a project'),
  dueDate: z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>
type ViewMode = 'board' | 'list' | 'calendar' | 'mine' | 'swimlanes' | 'timeline'

const CUSTOM_FIELD_PRESETS = ['Team', 'Client', 'Dates'] as const

function fieldKeyFromLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
}

function memberUser(membership: Membership): User | null {
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

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
  const [createAssigneeIds, setCreateAssigneeIds] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<TaskCustomField[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('board')
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>('')
  const [bulkAssignee, setBulkAssignee] = useState<string>('')
  const [wipLimits, setWipLimits] = useState<WipLimits>({})
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const activeOrg = useAppSelector((s) => s.org.activeOrganization)
  const membership = useAppSelector((s) => s.org.activeMembership)
  const currentUserId = useAppSelector((s) => s.auth.user?.id)
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const { can } = usePermissions()

  useEffect(() => {
    if (!orgId) return
    setWipLimits(mergeWipLimits(activeOrg?.settings?.wipLimits))
  }, [orgId, activeOrg?.settings?.wipLimits])

  const savedViewsQuery = useQuery({
    queryKey: ['saved-views', orgId, 'tasks'],
    queryFn: () => savedViewApi.list('tasks'),
    enabled: Boolean(orgId),
  })

  useEffect(() => {
    setSavedViews(savedViewsQuery.data ?? [])
  }, [savedViewsQuery.data])

  useEffect(() => {
    setSelectedTaskIds([])
  }, [view, projectFilter, statusFilter, priorityFilter])

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => projectApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && can('tasks:read'),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(orgId) && can('tasks:read'),
  })

  const teamsQuery = useQuery({
    queryKey: ['teams', orgId],
    queryFn: () => teamApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && open && can('tasks:create'),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', orgId, projectFilter || 'all'],
    queryFn: () =>
      taskApi.list({
        limit: 100,
        projectId: projectFilter || undefined,
      }),
    enabled: Boolean(orgId) && can('tasks:read'),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      projectId: projectFilter || '',
      dueDate: '',
    },
  })

  const resetCreateForm = () => {
    form.reset({
      title: '',
      description: '',
      priority: 'medium',
      projectId: projectFilter || '',
      dueDate: '',
    })
    setCreateAssigneeIds([])
    setCustomFields([])
    setNewFieldLabel('')
    setNewFieldValue('')
  }

  const addCustomField = (label: string, value: string) => {
    const trimmedLabel = label.trim()
    const trimmedValue = value.trim()
    if (!trimmedLabel || !trimmedValue) return
    const key = fieldKeyFromLabel(trimmedLabel) || `field_${customFields.length + 1}`
    setCustomFields((prev) => {
      const without = prev.filter((f) => f.key !== key)
      return [...without, { key, label: trimmedLabel, value: trimmedValue }]
    })
    setNewFieldLabel('')
    setNewFieldValue('')
  }

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      taskApi.create({
        projectId: values.projectId,
        title: values.title,
        description: values.description || undefined,
        priority: values.priority as TaskPriority,
        status: 'todo',
        assigneeIds: createAssigneeIds,
        dueDate: values.dueDate || null,
        customFields: customFields.filter((f) => f.label.trim() && f.value.trim()),
      }),
    onSuccess: async () => {
      toast.success('Task created')
      setOpen(false)
      resetCreateForm()
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

  const bulkMutation = useMutation({
    mutationFn: async ({
      ids,
      status,
      assigneeIds,
    }: {
      ids: string[]
      status?: TaskStatus
      assigneeIds?: string[]
    }) => {
      await Promise.all(
        ids.map(async (taskId) => {
          if (assigneeIds !== undefined) {
            await taskApi.update(taskId, { assigneeIds })
          }
          if (status) {
            const task = allTasks.find((t) => t.id === taskId)
            if (task && task.status !== status) {
              await taskApi.transition(taskId, status)
            }
          }
        }),
      )
    },
    onSuccess: async () => {
      toast.success('Tasks updated')
      setSelectedTaskIds([])
      setBulkStatus('')
      setBulkAssignee('')
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Bulk update failed')),
  })

  const allTasks = tasksQuery.data?.data.items ?? []
  const projects = projectsQuery.data?.data.items ?? []
  const members = membersQuery.data ?? []
  const teams = teamsQuery.data?.data.items ?? []

  const usersById = useMemo(() => {
    const map = new Map<string, User>()
    for (const m of membersQuery.data ?? []) {
      const u = memberUser(m)
      if (u) map.set(u.id, u)
    }
    return map
  }, [membersQuery.data])

  const memberNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const [id, user] of usersById) {
      map.set(id, user.name || user.email)
    }
    return map
  }, [usersById])

  const avgCycleTime = useMemo(() => averageCycleTimeMs(allTasks), [allTasks])

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
      dueDate: '',
    })
    setCreateAssigneeIds([])
    setCustomFields([])
    setOpen(true)
    searchParams.delete('open')
    searchParams.delete('title')
    searchParams.delete('description')
    searchParams.delete('priority')
    searchParams.delete('template')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length])

  useEffect(() => {
    const deepId = searchParams.get('taskId') || searchParams.get('highlight')
    if (!deepId) return
    dispatch(setActiveTaskId(deepId))
    searchParams.delete('taskId')
    searchParams.delete('highlight')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('taskId'), searchParams.get('highlight')])

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

  const swimlanes = useMemo(() => {
    const lanes = getAssigneeLanes(tasks, memberNames)
    return lanes.map((lane) => {
      const laneTasks = tasks.filter((task) => taskInAssigneeLane(task, lane.id))
      const cols: Record<string, Task[]> = {}
      for (const col of KANBAN_COLUMNS) cols[col.id] = []
      for (const task of laneTasks) {
        if (cols[task.status]) cols[task.status]!.push(task)
      }
      const user = lane.id === '__unassigned__' ? null : usersById.get(lane.id) || null
      return { ...lane, user, columns: cols }
    })
  }, [tasks, memberNames, usersById])

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

  const timelineTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [tasks],
  )

  const timelineRange = useMemo(() => {
    if (!timelineTasks.length) return null
    let min = Date.now()
    let max = Date.now()
    for (const task of timelineTasks) {
      const start = task.createdAt ? new Date(task.createdAt).getTime() : Date.now()
      const end = new Date(task.dueDate!).getTime()
      if (start < min) min = start
      if (end > max) max = end
    }
    const pad = 3 * 24 * 60 * 60 * 1000
    const rangeMin = min - pad
    const rangeMax = max + pad
    return { min: rangeMin, max: rangeMax, span: rangeMax - rangeMin }
  }, [timelineTasks])

  const moveTask = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    transitionMutation.mutate({ taskId, status })
  }

  const toggleTaskSelection = (taskId: string, checked: boolean) => {
    setSelectedTaskIds((prev) =>
      checked ? (prev.includes(taskId) ? prev : [...prev, taskId]) : prev.filter((id) => id !== taskId),
    )
  }

  const applyBulkEdit = () => {
    if (!selectedTaskIds.length) return
    const status = bulkStatus ? (bulkStatus as TaskStatus) : undefined
    const assigneeIds =
      bulkAssignee === '__clear__'
        ? []
        : bulkAssignee
          ? [bulkAssignee]
          : undefined
    if (!status && assigneeIds === undefined) {
      toast.error('Choose a status or assignee to apply')
      return
    }
    bulkMutation.mutate({ ids: selectedTaskIds, status, assigneeIds })
  }

  const editWipLimit = (columnId: TaskStatus, columnLabel: string) => {
    if (!orgId) return
    const current = wipLimits[columnId]
    const raw = window.prompt(
      `WIP limit for “${columnLabel}” (leave empty to remove)`,
      current?.toString() ?? '',
    )
    if (raw === null) return
    const trimmed = raw.trim()
    const next = { ...wipLimits }
    if (!trimmed) {
      delete next[columnId]
    } else {
      const n = Number.parseInt(trimmed, 10)
      if (Number.isNaN(n) || n < 0) {
        toast.error('Enter a non-negative number')
        return
      }
      next[columnId] = n
    }
    setWipLimits(next)
    void orgApi
      .updateWipLimits(orgId, next as Record<string, number>)
      .then((organization) => {
        if (membership) {
          dispatch(setActiveOrganization({ organization, membership }))
        }
        toast.success('WIP limits saved')
      })
      .catch((error) => {
        setWipLimits(mergeWipLimits(activeOrg?.settings?.wipLimits))
        toast.error(getErrorMessage(error))
      })
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

  const renderTaskCard = (task: Task) => (
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
        selectedTaskIds.includes(task.id) && 'border-primary/60 ring-1 ring-primary/30',
      )}
    >
      <div className="flex items-start gap-2">
        {can('tasks:update') ? (
          <Checkbox
            checked={selectedTaskIds.includes(task.id)}
            onCheckedChange={(checked) => toggleTaskSelection(task.id, Boolean(checked))}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
            aria-label={`Select ${task.title}`}
          />
        ) : null}
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
    </article>
  )

  const renderKanbanBoard = (columnMap: Record<string, Task[]>, compact?: boolean) => (
    <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-4', compact && 'gap-2')}>
      {KANBAN_COLUMNS.map((column) => {
        const count = columnMap[column.id]?.length ?? 0
        const limit = wipLimits[column.id]
        const overLimit = isOverWipLimit(count, limit)
        return (
          <section
            key={column.id}
            className={cn(
              'ts-kanban-column flex flex-col p-2.5 transition-colors',
              draggingId && can('tasks:update') && 'border-dashed border-primary/50 bg-primary/5',
              overLimit && 'border-destructive/60 bg-destructive/5',
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
              <Badge
                variant={overLimit ? 'destructive' : 'secondary'}
                className={cn('tabular-nums', can('tasks:update') && 'cursor-pointer')}
                title={can('tasks:update') ? 'Click to edit WIP limit' : undefined}
                onClick={() => can('tasks:update') && editWipLimit(column.id, column.label)}
              >
                {count}
                {limit != null ? ` / ${limit}` : ''}
              </Badge>
            </div>
            <div className={cn('flex-1 space-y-2', compact ? 'min-h-[72px]' : 'min-h-[120px]')}>
              {count === 0 ? (
                <div
                  className={cn(
                    'flex items-center justify-center rounded-lg border border-dashed border-border/70 px-2 text-center text-xs text-muted-foreground',
                    compact ? 'min-h-[56px] py-4' : 'min-h-[100px] py-8',
                  )}
                >
                  No tasks
                </div>
              ) : (
                (columnMap[column.id] ?? []).map((task) => renderTaskCard(task))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )

  const viewTabs: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'board', label: 'Board', icon: LayoutGrid },
    { id: 'swimlanes', label: 'By assignee', icon: Rows3 },
    { id: 'list', label: 'List', icon: ListIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'timeline', label: 'Timeline', icon: GanttChart },
    { id: 'mine', label: 'My Tasks', icon: UserRound },
  ]

  if (!can('tasks:read')) {
    return (
      <EmptyState
        title="No task access"
        description="Your role cannot view tasks in this workspace."
      />
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Tasks"
        description="Kanban, list, and calendar — drag cards across Todo → In Progress → In Review → Done."
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

      <div className="ts-filter-bar mb-4">
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
                void savedViewApi
                  .create({
                    scope: 'tasks',
                    name,
                    filters: {
                      projectId: projectFilter || 'all',
                      status: statusFilter,
                      priority: priorityFilter,
                      view,
                    },
                  })
                  .then(async () => {
                    toast.success('View saved')
                    await queryClient.invalidateQueries({ queryKey: ['saved-views', orgId, 'tasks'] })
                  })
                  .catch((error) => toast.error(getErrorMessage(error)))
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
                  void savedViewApi
                    .remove(saved.id)
                    .then(async () => {
                      await queryClient.invalidateQueries({
                        queryKey: ['saved-views', orgId, 'tasks'],
                      })
                    })
                    .catch((error) => toast.error(getErrorMessage(error)))
                }}
                title="Right-click to delete"
              >
                {saved.name}
              </Button>
            ))}
          </div>
        ) : null}

        {avgCycleTime != null ? (
          <Badge variant="outline" className="h-8 gap-1.5 px-2.5 tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            Avg cycle {formatCycleTime(avgCycleTime)}
          </Badge>
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

      {selectedTaskIds.length > 0 && can('tasks:update') ? (
        <div className="surface-panel mb-4 flex flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="text-sm font-medium tabular-nums">{selectedTaskIds.length} selected</span>
          <Select value={bulkStatus || '__none__'} onValueChange={(v) => setBulkStatus(v === '__none__' ? '' : v)}>
            <SelectTrigger className="h-8 w-[150px] bg-background">
              <SelectValue placeholder="Set status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Set status…</SelectItem>
              {KANBAN_COLUMNS.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={bulkAssignee || '__none__'}
            onValueChange={(v) => setBulkAssignee(v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="h-8 w-[170px] bg-background">
              <SelectValue placeholder="Set assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Set assignee…</SelectItem>
              <SelectItem value="__clear__">Unassigned</SelectItem>
              {[...usersById.values()].map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBulkEdit} disabled={bulkMutation.isPending}>
            {bulkMutation.isPending ? 'Applying…' : 'Apply'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedTaskIds([])}>
            Clear
          </Button>
        </div>
      ) : null}

      {!orgId ? (
        <EmptyState title="Select an organization" description="Choose a workspace to view its tasks." />
      ) : tasksQuery.isLoading ? (
        <LoadingState variant="board" />
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
      ) : (
        <>
          {(columns.in_progress?.length ?? 0) > 5 &&
          (view === 'board' || view === 'swimlanes') ? (
            <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              WIP limit: more than 5 in progress
            </div>
          ) : null}

          {view === 'list' || view === 'mine' ? (
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
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40',
                  selectedTaskIds.includes(task.id) && 'bg-primary/5',
                )}
                onClick={() => dispatch(setActiveTaskId(task.id))}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {can('tasks:update') ? (
                    <Checkbox
                      checked={selectedTaskIds.includes(task.id)}
                      onCheckedChange={(checked) => toggleTaskSelection(task.id, Boolean(checked))}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${task.title}`}
                    />
                  ) : null}
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
          ) : view === 'timeline' ? (
            timelineTasks.length === 0 || !timelineRange ? (
              <EmptyState
                title="No scheduled tasks"
                description="Tasks with due dates appear on the timeline."
              />
            ) : (
              <div className="surface-panel overflow-x-auto p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Task</span>
                  <span>
                    {new Date(timelineRange.min).toLocaleDateString()} –{' '}
                    {new Date(timelineRange.max).toLocaleDateString()}
                  </span>
                </div>
                <div className="min-w-[640px] space-y-3">
                  {timelineTasks.map((task) => {
                    const startMs = task.createdAt
                      ? new Date(task.createdAt).getTime()
                      : timelineRange.min
                    const endMs = new Date(task.dueDate!).getTime()
                    const left = ((startMs - timelineRange.min) / timelineRange.span) * 100
                    const width = Math.max(((endMs - startMs) / timelineRange.span) * 100, 1.5)
                    return (
                      <div
                        key={task.id}
                        className="grid grid-cols-[minmax(140px,180px)_1fr] items-center gap-3"
                      >
                        <button
                          type="button"
                          className="truncate text-left text-sm font-medium hover:text-primary"
                          onClick={() => dispatch(setActiveTaskId(task.id))}
                        >
                          #{task.number} {task.title}
                        </button>
                        <div className="relative h-8 rounded-md bg-muted/40">
                          <div
                            className={cn(
                              'absolute top-1 h-6 rounded-md px-2 text-[10px] font-medium leading-6 text-primary-foreground',
                              task.status === 'done'
                                ? 'bg-success'
                                : isOverdue(task.dueDate)
                                  ? 'bg-destructive'
                                  : 'bg-primary',
                            )}
                            style={{
                              left: `${Math.min(Math.max(left, 0), 98)}%`,
                              width: `${Math.min(width, 100 - left)}%`,
                            }}
                            title={`Due ${new Date(task.dueDate!).toLocaleDateString()}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ) : view === 'swimlanes' ? (
            tasks.length === 0 ? (
              <EmptyState title="No tasks found" description="Try a different project or filter." />
            ) : (
              <div className="space-y-4">
                {swimlanes.map((lane) => (
                  <div key={lane.id} className="surface-panel overflow-hidden p-3">
                    <div className="mb-2.5 flex items-center gap-2 px-1">
                      {lane.user ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
                          {getInitials(lane.user.name || lane.user.email)}
                        </span>
                      ) : (
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="text-sm font-semibold">{lane.label}</h3>
                      <Badge variant="secondary" className="tabular-nums">
                        {Object.values(lane.columns).reduce((n, list) => n + list.length, 0)}
                      </Badge>
                    </div>
                    {renderKanbanBoard(lane.columns, true)}
                  </div>
                ))}
              </div>
            )
          ) : (
            renderKanbanBoard(columns)
          )}
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetCreateForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" type="date" {...form.register('dueDate')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assignees</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {members
                  .map((m) => memberUser(m))
                  .filter(Boolean)
                  .map((user) => {
                    const u = user!
                    const checked = createAssigneeIds.includes(u.id)
                    return (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/60"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(on) => {
                            setCreateAssigneeIds((prev) =>
                              on ? [...prev, u.id] : prev.filter((id) => id !== u.id),
                            )
                          }}
                        />
                        <span className="min-w-0 truncate">{u.name || u.email}</span>
                      </label>
                    )
                  })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...form.register('description')} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Custom fields</Label>
                <div className="flex flex-wrap gap-1">
                  {CUSTOM_FIELD_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setNewFieldLabel(preset)
                        if (preset === 'Team') {
                          const first = teams[0]
                          if (first) setNewFieldValue(first.name)
                        }
                      }}
                    >
                      + {preset}
                    </Button>
                  ))}
                </div>
              </div>
              {customFields.length > 0 ? (
                <ul className="space-y-1.5 rounded-md border border-border p-2">
                  {customFields.map((field) => (
                    <li
                      key={field.key}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{field.label}</p>
                        <p className="truncate text-muted-foreground">{field.value}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() =>
                          setCustomFields((prev) => prev.filter((f) => f.key !== field.key))
                        }
                        aria-label={`Remove ${field.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Add Team, Client, or any field — they show on channel task cards like Slack.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder="Field label"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
                {newFieldLabel.trim().toLowerCase() === 'team' && teams.length > 0 ? (
                  <Select value={newFieldValue || undefined} onValueChange={setNewFieldValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.name}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Value"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                  />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!newFieldLabel.trim() || !newFieldValue.trim()}
                  onClick={() => addCustomField(newFieldLabel, newFieldValue)}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
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
