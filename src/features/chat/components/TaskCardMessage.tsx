import { CalendarDays, Flag, FolderKanban, ListTodo, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/utils/cn'
import type { MessageTaskCardMeta } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
}

const PRIORITY_VARIANT: Record<string, 'secondary' | 'outline' | 'warning' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'warning',
  urgent: 'destructive',
}

function eventHeadline(event?: string) {
  if (event === 'status') return 'Task status updated'
  if (event === 'assigned') return 'Task assignees updated'
  if (event === 'updated') return 'Task updated'
  return 'New task created'
}

interface TaskCardMessageProps {
  meta: MessageTaskCardMeta
  usersById?: Map<string, { name?: string; email?: string }>
  onOpenTask?: (taskId: string) => void
  onOpenThread?: () => void
  replyCount?: number
  className?: string
}

export function TaskCardMessage({
  meta,
  usersById,
  onOpenTask,
  onOpenThread,
  replyCount = 0,
  className,
}: TaskCardMessageProps) {
  const assigneeLabels = (meta.assigneeIds || [])
    .map((id) => usersById?.get(id)?.name || usersById?.get(id)?.email || 'Member')
    .filter(Boolean)

  return (
    <div
      className={cn(
        'mt-1.5 max-w-md overflow-hidden rounded-xl border border-border bg-[color:var(--ts-elevated,#1a2734)] shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/70 bg-primary/10 px-3 py-2">
        <ListTodo className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {eventHeadline(meta.event)}
        </span>
      </div>

      <div className="space-y-2.5 p-3">
        <button
          type="button"
          className="text-left text-sm font-semibold text-foreground hover:text-primary hover:underline"
          onClick={() => meta.taskId && onOpenTask?.(meta.taskId)}
        >
          {meta.number != null ? `#${meta.number} ` : null}
          {meta.title || 'Untitled task'}
        </button>

        <dl className="space-y-1.5 text-[12px]">
          {meta.projectName ? (
            <div className="flex items-start gap-2 text-muted-foreground">
              <FolderKanban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <dt className="sr-only">Project</dt>
                <dd className="text-foreground/90">{meta.projectName}</dd>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {meta.priority ? (
              <Badge variant={PRIORITY_VARIANT[meta.priority] || 'secondary'} className="gap-1">
                <Flag className="h-3 w-3" />
                {meta.priority}
              </Badge>
            ) : null}
            {meta.status ? (
              <Badge variant="outline">{STATUS_LABEL[meta.status] || meta.status}</Badge>
            ) : null}
            {meta.dueDate ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(meta.dueDate)}
              </span>
            ) : null}
          </div>
          {assigneeLabels.length > 0 ? (
            <div className="flex items-start gap-2 text-muted-foreground">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <dd className="text-foreground/90">{assigneeLabels.join(', ')}</dd>
            </div>
          ) : null}
          {meta.description ? (
            <p className="line-clamp-3 text-muted-foreground">{meta.description}</p>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          {meta.taskId && onOpenTask ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => onOpenTask(meta.taskId)}
            >
              Open task
            </Button>
          ) : null}
          {onOpenThread ? (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onOpenThread}>
              {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Discuss'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
