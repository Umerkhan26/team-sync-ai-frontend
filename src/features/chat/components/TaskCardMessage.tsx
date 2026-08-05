import type { ReactNode } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/utils/cn'
import type { MessageTaskCardMeta } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
}

const STATUS_EMOJI: Record<string, string> = {
  backlog: '⚪',
  todo: '🔵',
  in_progress: '🟢',
  in_review: '🟣',
  done: '✅',
  cancelled: '⛔',
}

const PRIORITY_EMOJI: Record<string, string> = {
  low: '⬇️',
  medium: '❗',
  high: '🔥',
  urgent: '🚨',
}

const FIELD_EMOJI: Record<string, string> = {
  team: '👥',
  client: '🏢',
  dates: '📆',
  budget: '💰',
  link: '🔗',
}

function eventHeadline(event?: string) {
  if (event === 'status') return '🔄 Task Status Updated'
  if (event === 'assigned') return '👥 Task Assignees Updated'
  if (event === 'updated') return '✏️ Task Updated'
  return '📋 New Task Created'
}

function fieldEmoji(key: string, label: string) {
  const k = key.toLowerCase()
  if (FIELD_EMOJI[k]) return FIELD_EMOJI[k]
  const l = label.toLowerCase()
  if (l.includes('team')) return '👥'
  if (l.includes('client')) return '🏢'
  if (l.includes('date')) return '📆'
  return '🔹'
}

interface TaskCardMessageProps {
  meta: MessageTaskCardMeta
  usersById?: Map<string, { name?: string; email?: string }>
  onOpenTask?: (taskId: string) => void
  onOpenThread?: () => void
  replyCount?: number
  className?: string
}

function FieldRow({
  emoji,
  label,
  children,
}: {
  emoji: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-x-1.5 text-[13.5px] leading-relaxed text-foreground/90">
      <span className="shrink-0">{emoji}</span>
      <span className="font-semibold text-foreground">{label}:</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
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
  const customFields = (meta.customFields || []).filter((f) => f.label && f.value?.trim())
  const statusKey = meta.status || ''
  const priorityKey = (meta.priority || '').toLowerCase()

  return (
    <div className={cn('mt-1 max-w-xl space-y-1', className)}>
      <p className="text-[13.5px] font-semibold text-foreground">{eventHeadline(meta.event)}</p>

      <div className="space-y-0.5 border-l-2 border-primary/40 pl-3">
        <FieldRow emoji="📌" label="Task">
          <button
            type="button"
            className="text-left font-medium text-primary hover:underline"
            onClick={() => meta.taskId && onOpenTask?.(meta.taskId)}
          >
            {meta.number != null ? `#${meta.number} ` : null}
            {meta.title || 'Untitled task'}
          </button>
        </FieldRow>

        {meta.projectName ? (
          <FieldRow emoji="🏗️" label="Project">
            <span className="font-medium text-primary">{meta.projectName}</span>
          </FieldRow>
        ) : null}

        {meta.priority ? (
          <FieldRow emoji="🚨" label="Priority">
            {PRIORITY_EMOJI[priorityKey] || '❗'} {meta.priority}
          </FieldRow>
        ) : null}

        {meta.dueDate ? (
          <FieldRow emoji="📅" label="Due Date">
            {formatDate(meta.dueDate)}
          </FieldRow>
        ) : null}

        {meta.status ? (
          <FieldRow emoji={STATUS_EMOJI[statusKey] || '🟢'} label="Status">
            {STATUS_LABEL[statusKey] || meta.status}
          </FieldRow>
        ) : null}

        {assigneeLabels.length > 0 ? (
          <FieldRow emoji="👥" label="Assignees">
            {assigneeLabels.join(', ')}
          </FieldRow>
        ) : null}

        {customFields.map((field) => (
          <FieldRow key={`${field.key}-${field.label}`} emoji={fieldEmoji(field.key, field.label)} label={field.label}>
            {field.value}
          </FieldRow>
        ))}

        {meta.description?.trim() ? (
          <FieldRow emoji="📝" label="Description">
            <span className="whitespace-pre-wrap text-foreground/85">{meta.description.trim()}</span>
          </FieldRow>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1.5">
        {meta.taskId && onOpenTask ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1 text-xs"
            onClick={() => onOpenTask(meta.taskId)}
          >
            <Bell className="h-3 w-3" />
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
  )
}
