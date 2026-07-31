import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  CalendarClock,
  FileText,
  FolderKanban,
  FolderOpen,
  HelpCircle,
  Home,
  LayoutTemplate,
  ListTodo,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setAiPanelOpen, setCommandOpen } from '@/store/uiSlice'
import { usePermissions } from '@/hooks/usePermissions'
import { projectApi } from '@/services/projectApi'
import { taskApi } from '@/services/taskApi'
import { documentApi } from '@/services/documentApi'
import { orgApi } from '@/services/orgApi'
import { cn, getInitials } from '@/utils/cn'
import type { Membership, User } from '@/types'

export function CommandPalette() {
  const open = useAppSelector((s) => s.ui.commandOpen)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { can, canManageWorkspace } = usePermissions()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        dispatch(setCommandOpen(!open))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId, 'cmdk'],
    queryFn: () => projectApi.list({ limit: 20 }),
    enabled: Boolean(open && orgId),
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks', orgId, 'cmdk'],
    queryFn: () => taskApi.list({ limit: 20 }),
    enabled: Boolean(open && orgId),
  })

  const docsQuery = useQuery({
    queryKey: ['documents', orgId, 'cmdk'],
    queryFn: () => documentApi.list({ limit: 20 }),
    enabled: Boolean(open && orgId),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId, 'cmdk'],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(open && orgId) && can('members:read'),
  })

  const projects = projectsQuery.data?.data.items ?? []
  const tasks = tasksQuery.data?.data.items ?? []
  const docs = docsQuery.data?.data.items ?? []
  const people = useMemo(() => {
    const list = membersQuery.data ?? []
    const seen = new Map<string, User>()
    for (const m of list as Membership[]) {
      const u = typeof m.userId === 'object' ? (m.userId as User) : null
      if (u) seen.set(u.id, u)
    }
    return Array.from(seen.values())
  }, [membersQuery.data])

  const navItems = useMemo(() => {
    const items = [
      { label: 'Home', to: '/app', icon: Home, show: true },
      { label: 'Projects', to: '/app/projects', icon: FolderKanban, show: can('projects:read') },
      { label: 'Tasks', to: '/app/tasks', icon: ListTodo, show: can('tasks:read') },
      { label: 'Chat', to: '/app/chat', icon: MessageSquare, show: can('channels:read') },
      { label: 'Documents', to: '/app/documents', icon: FileText, show: can('documents:read') },
      { label: 'Files', to: '/app/files', icon: FolderOpen, show: can('files:read') },
      { label: 'Teams', to: '/app/teams', icon: Users, show: can('teams:read') },
      { label: 'Meetings', to: '/app/meetings', icon: CalendarClock, show: can('meetings:read') },
      { label: 'Templates', to: '/app/templates', icon: LayoutTemplate, show: can('projects:create') },
      { label: 'AI Assistant', to: '/app/ai', icon: Bot, show: can('ai:use') },
      { label: 'Admin', to: '/app/admin', icon: Shield, show: canManageWorkspace },
      { label: 'Settings', to: '/app/settings', icon: Settings, show: true },
      { label: 'Help', to: '/app/help', icon: HelpCircle, show: true },
    ]
    return items.filter((i) => i.show)
  }, [can, canManageWorkspace])

  const run = (fn: () => void) => {
    dispatch(setCommandOpen(false))
    fn()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close command palette"
        onClick={() => dispatch(setCommandOpen(false))}
      />
      <div className="relative mx-auto mt-[14vh] w-full max-w-xl px-4">
        <Command
          className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
          label="Global command palette"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search or jump to…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </Command.Empty>

            <Command.Group heading="Navigate" className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
              {navItems.map((item) => (
                <Command.Item
                  key={item.to}
                  value={`nav ${item.label}`}
                  onSelect={() => run(() => navigate(item.to))}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent',
                  )}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions" className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
              {can('projects:create') ? (
                <Command.Item
                  value="create project"
                  onSelect={() => run(() => navigate('/app/projects'))}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  Create project
                </Command.Item>
              ) : null}
              {can('tasks:create') ? (
                <Command.Item
                  value="create task"
                  onSelect={() => run(() => navigate('/app/tasks'))}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  Create task
                </Command.Item>
              ) : null}
              {can('ai:use') ? (
                <Command.Item
                  value="open ai assistant"
                  onSelect={() =>
                    run(() => {
                      dispatch(setAiPanelOpen(true))
                    })
                  }
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI assistant
                </Command.Item>
              ) : null}
            </Command.Group>

            {projects.length ? (
              <Command.Group heading="Projects" className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
                {projects.map((project) => (
                  <Command.Item
                    key={project.id}
                    value={`project ${project.name} ${project.key}`}
                    onSelect={() => run(() => navigate(`/app/projects/${project.id}`))}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                  >
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{project.key}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {tasks.length ? (
              <Command.Group heading="Tasks" className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
                {tasks.map((task) => (
                  <Command.Item
                    key={task.id}
                    value={`task ${task.title} ${task.number}`}
                    onSelect={() => run(() => navigate(`/app/tasks?highlight=${task.id}`))}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                  >
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{task.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">#{task.number}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {docs.length ? (
              <Command.Group heading="Documents" className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
                {docs.map((doc) => (
                  <Command.Item
                    key={doc.id}
                    value={`document ${doc.title}`}
                    onSelect={() => run(() => navigate(`/app/documents/${doc.id}`))}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{doc.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {people.length ? (
              <Command.Group heading="People" className="mt-2 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1">
                {people.map((person) => (
                  <Command.Item
                    key={person.id}
                    value={`person ${person.name} ${person.email}`}
                    onSelect={() =>
                      run(() => navigate(canManageWorkspace ? '/app/admin' : '/app/teams'))
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-medium">
                      {getInitials(person.name || person.email)}
                    </span>
                    <span className="truncate">{person.name || person.email}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{person.email}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
