import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ListTodo } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { taskApi } from '@/services/taskApi'
import { projectApi } from '@/services/projectApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveTaskId } from '@/store/uiSlice'
import { getErrorMessage } from '@/utils/cn'
import {
  bodyToPlainTitle,
  chatMessageDeepLink,
  extractMentionIds,
  type MentionUser,
} from '@/features/chat/utils/mentions'
import type { Message, TaskPriority } from '@/types'

interface CreateTaskFromMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: Message | null
  channelId: string
  channelName?: string
  defaultProjectId?: string | null
  usersById: Map<string, MentionUser>
}

export function CreateTaskFromMessageDialog({
  open,
  onOpenChange,
  message,
  channelId,
  channelName,
  defaultProjectId,
  usersById,
}: CreateTaskFromMessageDialogProps) {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId, 'task-from-message'],
    queryFn: () => projectApi.list({ limit: 100 }),
    enabled: Boolean(orgId && open),
  })

  const projects = useMemo(
    () => (projectsQuery.data?.data.items ?? []).filter((p) => p.status !== 'archived'),
    [projectsQuery.data],
  )

  const mentionCandidates = useMemo(() => {
    if (!message) return [] as MentionUser[]
    const ids = extractMentionIds(message.body || '')
    const fromMentions = ids
      .map((id) => usersById.get(id))
      .filter(Boolean) as MentionUser[]
    if (fromMentions.length) return fromMentions
    return Array.from(usersById.values()).slice(0, 12)
  }, [message, usersById])

  useEffect(() => {
    if (!open || !message) return
    const link = chatMessageDeepLink(channelId, message.id)
    const channelLabel = channelName ? `#${channelName}` : 'chat'
    setTitle(bodyToPlainTitle(message.body || '', usersById))
    setDescription(
      [
        message.body?.trim() || '(no text — see attachments in chat)',
        '',
        `Source: ${channelLabel}`,
        link,
      ].join('\n'),
    )
    setPriority('medium')
    setAssigneeIds(extractMentionIds(message.body || ''))
    const preferred =
      (defaultProjectId && projects.some((p) => p.id === defaultProjectId)
        ? defaultProjectId
        : '') ||
      projects[0]?.id ||
      ''
    setProjectId(preferred)
  }, [open, message, channelId, channelName, usersById, defaultProjectId, projects])

  const createMutation = useMutation({
    mutationFn: () =>
      taskApi.create({
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeIds,
      }),
    onSuccess: async (result) => {
      toast.success('Task created from message')
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      dispatch(setActiveTaskId(result.task.id))
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create task')),
  })

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const canSubmit = Boolean(projectId && title.trim() && !createMutation.isPending)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Create task from message
          </DialogTitle>
          <DialogDescription>
            Prefills from the chat message. Mentions become assignees when possible. Opens the task
            drawer after create.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tfm-title">Title</Label>
            <Input
              id="tfm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId || undefined} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={projectsQuery.isLoading ? 'Loading…' : 'Select project'} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && !projectsQuery.isLoading ? (
                <p className="text-[11px] text-muted-foreground">
                  Create a project first — tasks must belong to one.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tfm-desc">Description</Label>
            <Textarea
              id="tfm-desc"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {mentionCandidates.length > 0 ? (
            <div className="space-y-2">
              <Label>Assignees</Label>
              <ul className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                {mentionCandidates.map((user) => (
                  <li key={user.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/60">
                      <Checkbox
                        checked={assigneeIds.includes(user.id)}
                        onCheckedChange={() => toggleAssignee(user.id)}
                      />
                      <span className="min-w-0 truncate font-medium">{user.name || user.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Mentions in the message are selected by default. Uncheck anyone you do not want.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || projects.length === 0}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Creating…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
