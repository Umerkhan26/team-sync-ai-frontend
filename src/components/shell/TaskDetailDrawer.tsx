import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Link2, Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { taskApi } from '@/services/taskApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveTaskId } from '@/store/uiSlice'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage } from '@/utils/cn'
import type { Task } from '@/types'

export function TaskDetailDrawer() {
  const taskId = useAppSelector((s) => s.ui.activeTaskId)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [blockerId, setBlockerId] = useState('')

  const taskQuery = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => taskApi.get(taskId!),
    enabled: Boolean(taskId),
  })

  const subtasksQuery = useQuery({
    queryKey: ['task-subtasks', taskId],
    queryFn: () => taskApi.listSubtasks(taskId!),
    enabled: Boolean(taskId),
  })

  const projectTasksQuery = useQuery({
    queryKey: ['tasks', orgId, taskQuery.data?.projectId, 'blockers'],
    queryFn: () => taskApi.list({ projectId: taskQuery.data!.projectId, limit: 100 }),
    enabled: Boolean(orgId && taskQuery.data?.projectId),
  })

  const commentsQuery = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => taskApi.listComments(taskId!),
    enabled: Boolean(taskId),
  })

  const activitiesQuery = useQuery({
    queryKey: ['task-activities', taskId],
    queryFn: () => taskApi.listActivities(taskId!),
    enabled: Boolean(taskId),
  })

  const invalidateTask = async () => {
    await queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    await queryClient.invalidateQueries({ queryKey: ['task-subtasks', taskId] })
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const createSubtask = useMutation({
    mutationFn: (title: string) =>
      taskApi.create({
        projectId: taskQuery.data!.projectId,
        title,
        parentTaskId: taskId!,
        status: 'todo',
        priority: taskQuery.data?.priority || 'medium',
      }),
    onSuccess: async () => {
      setSubtaskTitle('')
      toast.success('Subtask added')
      await invalidateTask()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateBlockers = useMutation({
    mutationFn: (blockedByTaskIds: string[]) => taskApi.update(taskId!, { blockedByTaskIds }),
    onSuccess: async () => {
      setBlockerId('')
      toast.success('Dependencies updated')
      await invalidateTask()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const task = taskQuery.data
  const projectTasks = projectTasksQuery.data?.data.items ?? []
  const blockerTasks = projectTasks.filter((t) =>
    (task?.blockedByTaskIds || []).map(String).includes(t.id),
  )
  const blockerCandidates = projectTasks.filter(
    (t) => t.id !== taskId && !(task?.blockedByTaskIds || []).map(String).includes(t.id),
  )

  return (
    <Sheet
      open={Boolean(taskId)}
      onOpenChange={(open) => {
        if (!open) dispatch(setActiveTaskId(null))
      }}
    >
      <SheetContent side="right" className="sm:max-w-lg">
        {taskQuery.isLoading ? (
          <div className="p-5">
            <LoadingState rows={5} />
          </div>
        ) : taskQuery.isError || !task ? (
          <div className="p-5">
            <ErrorState onRetry={() => void taskQuery.refetch()} />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 leading-snug">{task.title}</SheetTitle>
              <SheetDescription>
                #{task.number}
                {task.parentTaskId ? ' · subtask' : ''}
                {task.dueDate
                  ? ` · due ${format(new Date(task.dueDate), 'MMM d, yyyy')}`
                  : ''}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">
                  {task.status.replaceAll('_', ' ')}
                </Badge>
                <Badge
                  variant={
                    task.priority === 'urgent' || task.priority === 'high'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="capitalize"
                >
                  {task.priority}
                </Badge>
                {(task.blockedByTaskIds?.length || 0) > 0 ? (
                  <Badge variant="warning">Blocked</Badge>
                ) : null}
                {task.labels?.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </h3>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {task.description?.trim() || 'No description yet.'}
                </p>
              </section>

              <Separator />

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Subtasks
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {(subtasksQuery.data ?? []).length}
                  </span>
                </div>
                {subtasksQuery.isLoading ? (
                  <LoadingState rows={2} />
                ) : (
                  <ul className="space-y-1.5">
                    {(subtasksQuery.data ?? []).map((sub: Task) => (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => dispatch(setActiveTaskId(sub.id))}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left text-sm transition hover:bg-accent/40"
                        >
                          <span className="truncate">
                            <span className="mr-1.5 font-mono text-muted-foreground">
                              #{sub.number}
                            </span>
                            {sub.title}
                          </span>
                          <Badge variant="outline" className="shrink-0 capitalize">
                            {sub.status.replaceAll('_', ' ')}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {can('tasks:create') ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!subtaskTitle.trim()) return
                      createSubtask.mutate(subtaskTitle.trim())
                    }}
                  >
                    <Input
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      placeholder="Add a subtask…"
                      className="h-8"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={createSubtask.isPending || !subtaskTitle.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                ) : null}
              </section>

              <Separator />

              <section className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Blocked by
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This task cannot move to In progress / Done until blockers are finished.
                </p>
                {blockerTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No dependencies.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {blockerTasks.map((blocker) => (
                      <li
                        key={blocker.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 truncate text-left hover:underline"
                          onClick={() => dispatch(setActiveTaskId(blocker.id))}
                        >
                          #{blocker.number} {blocker.title}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="capitalize">
                            {blocker.status.replaceAll('_', ' ')}
                          </Badge>
                          {can('tasks:update') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                updateBlockers.mutate(
                                  (task.blockedByTaskIds || []).filter((id) => id !== blocker.id),
                                )
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {can('tasks:update') && blockerCandidates.length > 0 ? (
                  <div className="flex gap-2">
                    <Select value={blockerId} onValueChange={setBlockerId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Add blocker…" />
                      </SelectTrigger>
                      <SelectContent>
                        {blockerCandidates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            #{t.number} {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={!blockerId || updateBlockers.isPending}
                      onClick={() =>
                        updateBlockers.mutate([...(task.blockedByTaskIds || []), blockerId])
                      }
                    >
                      Add
                    </Button>
                  </div>
                ) : null}
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Comments
                </h3>
                {commentsQuery.isLoading ? (
                  <LoadingState rows={2} />
                ) : (commentsQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {(commentsQuery.data ?? []).map((c) => (
                      <li key={c.id} className="rounded-md border border-border p-3 text-sm">
                        <p className="whitespace-pre-wrap">{c.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {c.createdAt
                            ? format(new Date(c.createdAt), 'MMM d · HH:mm')
                            : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Activity
                </h3>
                {activitiesQuery.isLoading ? (
                  <LoadingState rows={2} />
                ) : (activitiesQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {(activitiesQuery.data ?? []).map((a) => (
                      <li key={a.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{a.type}</span>
                        {a.createdAt
                          ? ` · ${format(new Date(a.createdAt), 'MMM d HH:mm')}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
