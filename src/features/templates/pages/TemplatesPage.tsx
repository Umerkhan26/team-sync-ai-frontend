import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FileText, FolderKanban, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { templateApi } from '@/services/templateApi'
import { getErrorMessage } from '@/utils/cn'
import type { WorkspaceTemplate } from '@/types'

type TemplateKind = 'project' | 'task' | 'document'

interface TemplateEntry {
  id: string
  kind: TemplateKind
  title: string
  description: string
  tags: string[]
  params: Record<string, string>
  custom?: boolean
}

const TEMPLATES: TemplateEntry[] = [
  {
    id: 'proj-web-launch',
    kind: 'project',
    title: 'Website launch',
    description: 'Plan, build, and ship a marketing site with design, dev, and QA phases.',
    tags: ['Marketing', 'Design'],
    params: { name: 'Website launch', description: 'Plan, build, and ship the new marketing site.' },
  },
  {
    id: 'proj-product-sprint',
    kind: 'project',
    title: 'Product sprint',
    description: 'A two-week sprint template for cross-functional product teams.',
    tags: ['Product', 'Engineering'],
    params: { name: 'Product sprint', description: 'Two-week sprint to ship the next increment.' },
  },
  {
    id: 'proj-client-onboarding',
    kind: 'project',
    title: 'Client onboarding',
    description: 'Track kickoff calls, contracts, and setup tasks for a new client.',
    tags: ['Services'],
    params: { name: 'Client onboarding', description: 'Kickoff, contracts, and setup for a new client.' },
  },
  {
    id: 'task-bug-report',
    kind: 'task',
    title: 'Bug report',
    description: 'Structured task for reporting and triaging a bug.',
    tags: ['Engineering'],
    params: {
      title: 'Bug: ',
      description: 'Steps to reproduce:\n1. \n2. \n\nExpected:\nActual:',
      priority: 'high',
    },
  },
  {
    id: 'task-feature-request',
    kind: 'task',
    title: 'Feature request',
    description: 'Capture a new feature idea with context and acceptance criteria.',
    tags: ['Product'],
    params: {
      title: 'Feature: ',
      description: 'Problem:\n\nProposed solution:\n\nAcceptance criteria:\n- ',
      priority: 'medium',
    },
  },
  {
    id: 'task-weekly-checkin',
    kind: 'task',
    title: 'Weekly check-in',
    description: 'Recurring task template for team status updates.',
    tags: ['Operations'],
    params: { title: 'Weekly check-in', description: 'Wins, blockers, and priorities for next week.', priority: 'low' },
  },
  {
    id: 'doc-meeting-notes',
    kind: 'document',
    title: 'Meeting notes',
    description: 'Agenda, discussion points, and action items layout.',
    tags: ['Meetings'],
    params: { title: 'Meeting notes — ' },
  },
  {
    id: 'doc-prd',
    kind: 'document',
    title: 'Product requirements doc',
    description: 'PRD skeleton with problem statement, goals, and scope.',
    tags: ['Product'],
    params: { title: 'PRD: ' },
  },
  {
    id: 'doc-runbook',
    kind: 'document',
    title: 'Ops runbook',
    description: 'Step-by-step runbook template for operational procedures.',
    tags: ['Operations'],
    params: { title: 'Runbook: ' },
  },
]

const KIND_META: Record<TemplateKind, { label: string; icon: typeof FolderKanban; route: string }> = {
  project: { label: 'Project', icon: FolderKanban, route: '/app/projects' },
  task: { label: 'Task', icon: ListTodo, route: '/app/tasks' },
  document: { label: 'Document', icon: FileText, route: '/app/documents' },
}

const EMPTY_FORM = {
  kind: 'project' as TemplateKind,
  title: '',
  description: '',
  tags: '',
}

function apiTemplateToEntry(t: WorkspaceTemplate): TemplateEntry {
  const kind = (t.kind === 'meeting' ? 'document' : t.kind) as TemplateKind
  const payload = (t.payload || {}) as Record<string, string>
  const params: Record<string, string> =
    kind === 'project'
      ? { name: payload.name || t.name, description: payload.description || t.description || '' }
      : kind === 'task'
        ? {
            title: payload.title || t.name,
            description: payload.description || t.description || '',
            priority: payload.priority || 'medium',
          }
        : { title: payload.title || t.name }

  return {
    id: t.id,
    kind,
    title: t.name,
    description: t.description || '',
    tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
    params,
    custom: true,
  }
}

function buildPayload(kind: TemplateKind, title: string, description: string, tags: string[]) {
  if (kind === 'project') {
    return { name: title, description, tags }
  }
  if (kind === 'task') {
    return { title, description, priority: 'medium', tags }
  }
  return { title, tags }
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [tab, setTab] = useState<'all' | TemplateKind | 'custom'>('all')
  const [preview, setPreview] = useState<TemplateEntry | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceTemplate | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const customTemplatesQuery = useQuery({
    queryKey: ['templates', orgId],
    queryFn: () => templateApi.list(),
    enabled: Boolean(orgId),
  })

  const customTemplates = useMemo(
    () => (customTemplatesQuery.data?.data.items ?? []).filter((t) => t.kind !== 'meeting'),
    [customTemplatesQuery.data],
  )

  const canUse: Record<TemplateKind, boolean> = {
    project: can('projects:create'),
    task: can('tasks:create'),
    document: can('documents:create'),
  }

  const allTemplates = useMemo(() => {
    const custom = customTemplates.map(apiTemplateToEntry)
    return [...custom, ...TEMPLATES]
  }, [customTemplates])

  const visible = useMemo(() => {
    if (tab === 'custom') return customTemplates.map(apiTemplateToEntry)
    return allTemplates.filter((t) => tab === 'all' || t.kind === tab)
  }, [tab, allTemplates, customTemplates])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required')
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const payload = buildPayload(form.kind, form.title.trim(), form.description.trim(), tags)
      if (editing) {
        return templateApi.update(editing.id, {
          kind: form.kind,
          name: form.title.trim(),
          description: form.description.trim(),
          payload,
        })
      }
      return templateApi.create({
        kind: form.kind,
        name: form.title.trim(),
        description: form.description.trim(),
        payload,
      })
    },
    onSuccess: async () => {
      toast.success(editing ? 'Template updated' : 'Template created')
      setEditorOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['templates', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => templateApi.remove(id),
    onSuccess: async () => {
      toast.success('Template deleted')
      await queryClient.invalidateQueries({ queryKey: ['templates', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const applyTemplate = (template: TemplateEntry) => {
    const meta = KIND_META[template.kind]
    const query = new URLSearchParams({ open: '1', template: template.id, ...template.params })
    navigate(`${meta.route}?${query.toString()}`)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (template: WorkspaceTemplate) => {
    setEditing(template)
    const payload = (template.payload || {}) as Record<string, string>
    const tags = Array.isArray(payload.tags) ? (payload.tags as string[]).join(', ') : ''
    setForm({
      kind: template.kind as TemplateKind,
      title: template.name,
      description: template.description || '',
      tags,
    })
    setEditorOpen(true)
  }

  const saveForm = () => {
    if (!orgId || !form.title.trim()) {
      toast.error('Title is required')
      return
    }
    saveMutation.mutate()
  }

  const removeTemplate = (id: string) => {
    removeMutation.mutate(id)
  }

  const renderCard = (template: TemplateEntry) => {
    const meta = KIND_META[template.kind]
    return (
      <div
        key={template.id}
        className="surface-panel group relative flex flex-col gap-3 overflow-hidden p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 transition group-hover:scale-125"
        />
        <div className="relative flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <meta.icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {template.custom ? (
              <Badge variant="outline" className="text-[10px]">
                Custom
              </Badge>
            ) : null}
            {template.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="relative">
          <p className="app-title text-sm">{template.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{template.description}</p>
        </div>
        <div className="relative mt-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreview(template)}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            disabled={!canUse[template.kind]}
            onClick={() => applyTemplate(template)}
          >
            Use template
          </Button>
          {template.custom ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const raw = customTemplates.find((t) => t.id === template.id)
                  if (raw) openEdit(raw)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeTemplate(template.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Jump-start"
        title="Templates"
        description="Ready-made starters for projects, tasks, and documents — plus org-custom templates."
        actions={
          orgId ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              New custom template
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="task">Task</TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="custom">Custom ({customTemplates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          {customTemplatesQuery.isLoading && tab === 'custom' ? (
            <LoadingState variant="grid" rows={6} />
          ) : customTemplatesQuery.isError && tab === 'custom' ? (
            <ErrorState onRetry={() => void customTemplatesQuery.refetch()} />
          ) : visible.length === 0 ? (
            <EmptyState
              title={tab === 'custom' ? 'No custom templates yet' : 'No templates in this category'}
              description={
                tab === 'custom'
                  ? 'Create a template tailored to your team workflow.'
                  : undefined
              }
              actionLabel={tab === 'custom' ? 'Create template' : undefined}
              onAction={tab === 'custom' ? openCreate : undefined}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(renderCard)}</div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-lg">
          {preview ? (
            <>
              <DialogHeader>
                <DialogTitle>{preview.title}</DialogTitle>
                <DialogDescription>{preview.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{KIND_META[preview.kind].label}</Badge>
                  {preview.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="surface-panel space-y-2 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Prefilled fields
                  </p>
                  <dl className="space-y-2 text-sm">
                    {Object.entries(preview.params).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-medium capitalize text-muted-foreground">{key}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-xs">
                          {value || '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Close
                </Button>
                <Button
                  disabled={!canUse[preview.kind]}
                  onClick={() => {
                    applyTemplate(preview)
                    setPreview(null)
                  }}
                >
                  Use template
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit template' : 'New custom template'}</DialogTitle>
            <DialogDescription>
              Saved to this workspace and shared with your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as TemplateKind }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-title">Title</Label>
              <Input
                id="tpl-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Sprint kickoff"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-tags">Tags (comma-separated)</Label>
              <Input
                id="tpl-tags"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Engineering, Sprint"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveForm} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
