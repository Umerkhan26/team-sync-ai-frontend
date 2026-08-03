import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Bot,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileText,
  FolderKanban,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Plug,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { cn, getInitials } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppDispatch, useAppSelector } from '@/store'
import { logout } from '@/store/authSlice'
import { clearActiveOrganization } from '@/store/orgSlice'
import {
  setAiPanelOpen,
  setCommandOpen,
  setMobileNavOpen,
  setNotificationsOpen,
  toggleSidebar,
  toggleTheme,
} from '@/store/uiSlice'
import { authApi } from '@/services/authApi'
import { notificationApi } from '@/services/notificationApi'
import { disconnectSocket } from '@/services/socket'
import { useSocket } from '@/hooks/useSocket'
import { useOrganizationsSync } from '@/hooks/useOrganizationsSync'
import { usePermissions, type Permission } from '@/hooks/usePermissions'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'
import { OrgSwitcher } from '@/features/organizations/components/OrgSwitcher'
import { AppShellSkeleton } from '@/components/shared/LoadingState'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { AiPanel } from '@/components/shell/AiPanel'
import { NotificationCenter } from '@/components/shell/NotificationCenter'
import { TaskDetailDrawer } from '@/components/shell/TaskDetailDrawer'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  permission?: Permission | Permission[]
}

const workspaceNav: NavItem[] = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban, permission: 'projects:read' },
  { to: '/app/tasks', label: 'Tasks', icon: ListTodo, permission: 'tasks:read' },
  { to: '/app/chat', label: 'Chat', icon: MessageSquare, permission: 'channels:read' },
  { to: '/app/documents', label: 'Docs', icon: FileText, permission: 'documents:read' },
  { to: '/app/files', label: 'Files', icon: FolderOpen, permission: 'files:read' },
  { to: '/app/teams', label: 'Teams', icon: Users, permission: 'teams:read' },
  { to: '/app/meetings', label: 'Meetings', icon: CalendarClock, permission: 'meetings:read' },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate, permission: 'projects:create' },
]

const manageNav: NavItem[] = [
  { to: '/app/integrations', label: 'Integrations', icon: Plug, permission: 'org:read' },
  { to: '/app/admin', label: 'Admin', icon: Shield, permission: ['members:invite', 'roles:manage', 'org:update', 'audit:read'] },
  { to: '/app/billing', label: 'Billing', icon: CreditCard, permission: 'org:billing' },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/help', label: 'Help', icon: HelpCircle },
]

function breadcrumbLabel(pathname: string) {
  if (pathname === '/app') return 'Home'
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || 'Home'
  const prev = parts[parts.length - 2]

  const labels: Record<string, string> = {
    app: 'Home',
    projects: 'Projects',
    tasks: 'Tasks',
    chat: 'Chat',
    documents: 'Documents',
    files: 'Files',
    teams: 'Teams',
    meetings: 'Meetings',
    templates: 'Templates',
    integrations: 'Integrations',
    ai: 'AI',
    admin: 'Admin',
    billing: 'Billing',
    settings: 'Settings',
    help: 'Help',
    room: 'Room',
  }

  if (labels[last]) return labels[last]

  // ObjectId / UUID-looking segments → friendly parent label
  if (/^[a-f0-9]{24}$/i.test(last) || /^[0-9a-f-]{36}$/i.test(last)) {
    if (prev === 'projects') return 'Project'
    if (prev === 'documents') return 'Document'
    if (prev === 'meetings') return 'Meeting'
    return 'Detail'
  }

  return last.charAt(0).toUpperCase() + last.slice(1)
}

export function AppLayout() {
  useSurfaceMode('app')
  useSocket()
  const orgsQuery = useOrganizationsSync()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { can, canAny, roleName, isGuest } = usePermissions()
  const user = useAppSelector((s) => s.auth.user)
  const theme = useAppSelector((s) => s.ui.theme)
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen)
  const mobileNavOpen = useAppSelector((s) => s.ui.mobileNavOpen)
  const activeOrg = useAppSelector((s) => s.org.activeOrganization)
  const refreshToken = useAppSelector((s) => s.auth.refreshToken)

  const notifQuery = useQuery({
    queryKey: ['notifications', activeOrg?.id],
    queryFn: () =>
      notificationApi.list({ limit: 40, organizationId: activeOrg?.id }),
    enabled: Boolean(activeOrg?.id),
    refetchInterval: 60_000,
  })
  const unread =
    notifQuery.data?.data.items.filter((n) => !n.readAt).length ?? 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        dispatch(toggleSidebar())
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j' && can('ai:use')) {
        e.preventDefault()
        dispatch(setAiPanelOpen(true))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, can])

  const visibleWorkspace = workspaceNav.filter((item) => {
    if (!item.permission) return true
    if (Array.isArray(item.permission)) return canAny(item.permission)
    return can(item.permission)
  })

  const visibleManage = manageNav.filter((item) => {
    if (!item.permission) return true
    if (Array.isArray(item.permission)) return canAny(item.permission)
    return can(item.permission)
  })

  const handleLogout = async () => {
    try {
      await authApi.logout(refreshToken)
    } catch {
      // ignore
    }
    disconnectSocket()
    dispatch(logout())
    dispatch(clearActiveOrganization())
    navigate('/login')
  }

  if (orgsQuery.isLoading) {
    return <AppShellSkeleton />
  }

  if (orgsQuery.isSuccess && (!orgsQuery.data || orgsQuery.data.length === 0)) {
    return <Navigate to="/onboarding" replace />
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }, collapsed: boolean) =>
    cn(
      'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[color:var(--ts-sidebar-muted)] transition-all duration-150 hover:bg-[color:var(--ts-sidebar-hover)] hover:text-[color:var(--ts-sidebar-foreground)]',
      isActive &&
        'bg-[color:var(--ts-sidebar-active)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]',
      collapsed && 'justify-center px-0',
    )

  const renderNav = (collapsed: boolean) => (
    <div className="ts-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
      <div>
        {!collapsed ? (
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ts-sidebar-muted)]">
            Workspace
          </p>
        ) : null}
        <nav className="flex flex-col gap-0.5">
          {visibleWorkspace.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={() => dispatch(setMobileNavOpen(false))}
              className={({ isActive }) => navLinkClass({ isActive }, collapsed)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </NavLink>
          ))}
          {can('ai:use') ? (
            <button
              type="button"
              title="AI Assistant"
              onClick={() => {
                dispatch(setMobileNavOpen(false))
                dispatch(setAiPanelOpen(true))
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-[color:var(--ts-sidebar-muted)] transition hover:bg-[color:var(--ts-sidebar-hover)] hover:text-[color:var(--ts-sidebar-foreground)]',
                collapsed && 'justify-center px-0',
              )}
            >
              <Bot className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>AI</span> : null}
            </button>
          ) : null}
        </nav>
      </div>

      {visibleManage.length ? (
        <div>
          {!collapsed ? (
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ts-sidebar-muted)]">
              Manage
            </p>
          ) : null}
          <nav className="flex flex-col gap-0.5">
            {visibleManage.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={() => dispatch(setMobileNavOpen(false))}
                className={({ isActive }) => navLinkClass({ isActive }, collapsed)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </NavLink>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  )

  const isChat = location.pathname.startsWith('/app/chat')
  const isMeetingRoom = /\/app\/meetings\/[^/]+\/room/.test(location.pathname)
  const isImmersive = isChat || isMeetingRoom

  return (
    <div className="h-dvh max-h-dvh min-w-0 overflow-hidden lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <aside
        className={cn(
          'ts-sidebar hidden h-dvh min-h-0 flex-col overflow-hidden border-r transition-[width] lg:flex',
          sidebarOpen ? 'w-[240px]' : 'w-[64px]',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[color:var(--ts-sidebar-border)] px-3">
          <img src="/brand/logo-mark.png" alt="TeamSync AI" className="h-7 w-7 rounded-md" />
          {sidebarOpen ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">TeamSync AI</p>
              <p className="truncate text-[11px] text-[color:var(--ts-sidebar-muted)]">
                {roleName}
              </p>
            </div>
          ) : null}
        </div>
        {renderNav(!sidebarOpen)}
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => dispatch(setMobileNavOpen(false))}
          />
          <aside className="ts-sidebar relative z-50 flex h-full w-72 flex-col overflow-hidden shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[color:var(--ts-sidebar-border)] px-4">
              <div className="flex items-center gap-2">
                <img src="/brand/logo-mark.png" alt="TeamSync AI" className="h-7 w-7 rounded-md" />
                <span className="text-sm font-semibold">TeamSync AI</span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-[color:var(--ts-sidebar-foreground)] hover:bg-white/10"
                onClick={() => dispatch(setMobileNavOpen(false))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      ) : null}

      <div className="ts-content-frame flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="ts-topbar z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => dispatch(setMobileNavOpen(true))}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Toggle sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>

          <div className="min-w-0">
            <OrgSwitcher />
          </div>

          <div className="mx-1 hidden min-w-0 items-center gap-1 text-xs text-muted-foreground md:flex">
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="truncate">{breadcrumbLabel(location.pathname)}</span>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-8 gap-2 text-muted-foreground sm:inline-flex"
              onClick={() => dispatch(setCommandOpen(true))}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="rounded border border-border bg-muted px-1 text-[10px]">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              onClick={() => dispatch(setCommandOpen(true))}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            {!isGuest ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Create</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {can('projects:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/projects?open=1')}>
                      Project
                    </DropdownMenuItem>
                  ) : null}
                  {can('tasks:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/tasks?open=1')}>
                      Task
                    </DropdownMenuItem>
                  ) : null}
                  {can('documents:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/documents?open=1')}>
                      Document
                    </DropdownMenuItem>
                  ) : null}
                  {can('channels:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/chat?open=1')}>
                      Channel
                    </DropdownMenuItem>
                  ) : null}
                  {can('meetings:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/meetings?open=1')}>
                      Meeting
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {can('ai:use') ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => dispatch(setAiPanelOpen(true))}
                aria-label="Open AI assistant"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
              onClick={() => dispatch(setNotificationsOpen(true))}
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => dispatch(toggleTheme())}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {isGuest ? (
              <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 sm:inline">
                Guest
              </span>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 px-1.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.avatarUrl || undefined} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(user?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <p>{user?.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                    {activeOrg ? (
                      <p className="text-xs font-normal text-muted-foreground">
                        {activeOrg.name} · {roleName}
                      </p>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                  <Settings className="h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleLogout()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={cn(
            'ts-main-canvas mx-auto w-full min-h-0 min-w-0 max-w-[1440px] flex-1 animate-in-fade',
            isImmersive
              ? 'flex flex-col overflow-hidden px-2 py-1.5 sm:px-3'
              : 'overflow-x-hidden overflow-y-auto px-4 py-2.5 sm:px-6 lg:px-8',
          )}
        >
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <AiPanel />
      <NotificationCenter />
      <TaskDetailDrawer />
    </div>
  )
}
