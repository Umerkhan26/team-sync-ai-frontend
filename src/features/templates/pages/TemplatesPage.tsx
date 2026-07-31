import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FolderKanban, ListTodo } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermissions } from '@/hooks/usePermissions'

type TemplateKind = 'project' | 'task' | 'document'

interface TemplateEntry {
  id: string
  kind: TemplateKind
  title: string
  description: string
  tags: string[]
  params: Record<string, string>
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

export function TemplatesPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const [tab, setTab] = useState<'all' | TemplateKind>('all')

  const canUse: Record<TemplateKind, boolean> = {
    project: can('projects:create'),
    task: can('tasks:create'),
    document: can('documents:create'),
  }

  const visible = useMemo(
    () => TEMPLATES.filter((t) => tab === 'all' || t.kind === tab),
    [tab],
  )

  const applyTemplate = (template: TemplateEntry) => {
    const meta = KIND_META[template.kind]
    const query = new URLSearchParams({ open: '1', template: template.id, ...template.params })
    navigate(`${meta.route}?${query.toString()}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Jump-start projects, tasks, and documents with ready-made templates."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="task">Task</TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          {visible.length === 0 ? (
            <EmptyState title="No templates in this category yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((template) => {
                const meta = KIND_META[template.kind]
                return (
                  <div key={template.id} className="surface-panel flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <meta.icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="app-title text-sm">{template.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    <Button
                      size="sm"
                      className="mt-auto self-start"
                      disabled={!canUse[template.kind]}
                      onClick={() => applyTemplate(template)}
                    >
                      Use template
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
