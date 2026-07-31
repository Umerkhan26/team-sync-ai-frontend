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
import { PageLoading } from '@/components/shared/LoadingState'
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
  { to: '/app/admin', label: 'Admin', icon: Shield, permission: ['members:invite', 'roles:manage', 'org:update', 'audit:read'] },
  { to: '/app/billing', label: 'Billing', icon: CreditCard, permission: 'org:billing' },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/help', label: 'Help', icon: HelpCircle },
]

function breadcrumbLabel(pathname: string) {
  if (pathname === '/app') return 'Home'
  const part = pathname.split('/').filter(Boolean).pop() || 'Home'
  return part.charAt(0).toUpperCase() + part.slice(1)
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
    queryKey: ['notifications', activeOrg?.id, 'badge'],
    queryFn: () =>
      notificationApi.list({ limit: 20, organizationId: activeOrg?.id }),
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
    return (
      <div className="mx-auto max-w-3xl p-8">
        <PageLoading />
      </div>
    )
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
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-3">
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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      <aside
        className={cn(
          'ts-sidebar sticky top-0 hidden h-screen flex-col border-r transition-[width] lg:flex',
          sidebarOpen ? 'w-[240px]' : 'w-[64px]',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-[color:var(--ts-sidebar-border)] px-3">
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
          <aside className="ts-sidebar relative z-50 flex h-full w-72 flex-col shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-[color:var(--ts-sidebar-border)] px-4">
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

      <div className="ts-content-frame flex min-h-screen flex-col">
        <header className="ts-topbar sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 sm:px-4">
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
                    <DropdownMenuItem onClick={() => navigate('/app/projects')}>
                      Project
                    </DropdownMenuItem>
                  ) : null}
                  {can('tasks:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/tasks')}>
                      Task
                    </DropdownMenuItem>
                  ) : null}
                  {can('documents:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/documents')}>
                      Document
                    </DropdownMenuItem>
                  ) : null}
                  {can('channels:create') ? (
                    <DropdownMenuItem onClick={() => navigate('/app/chat')}>
                      Channel
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
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
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

        <main className="ts-main-canvas mx-auto w-full max-w-[1440px] flex-1 animate-in-fade px-4 py-6 sm:px-6 lg:px-8">
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
