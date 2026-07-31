import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell,
  Building2,
  Keyboard,
  KeyRound,
  Laptop2,
  MonitorSmartphone,
  Moon,
  Palette,
  Shield,
  Sun,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { orgApi } from '@/services/orgApi'
import { fileApi } from '@/services/fileApi'
import { authApi } from '@/services/authApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setUser } from '@/store/authSlice'
import { setActiveOrganization } from '@/store/orgSlice'
import { setTheme } from '@/store/uiSlice'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, getErrorMessage, getInitials } from '@/utils/cn'
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/types'

const orgSchema = z.object({
  name: z.string().min(1).max(120),
  allowGuestInvites: z.boolean(),
  defaultRoleSlug: z.string().min(1),
})

type OrgForm = z.infer<typeof orgSchema>

type SectionId = 'profile' | 'appearance' | 'notifications' | 'security' | 'organization'

const NOTIF_ROWS: {
  key: keyof Pick<
    NotificationPreferences,
    | 'emailTasks'
    | 'emailMentions'
    | 'emailInvites'
    | 'inAppTasks'
    | 'inAppMentions'
    | 'inAppInvites'
  >
  label: string
  group: 'email' | 'inApp'
}[] = [
  { key: 'emailTasks', label: 'Task assignments & updates', group: 'email' },
  { key: 'emailMentions', label: 'Mentions in comments & chat', group: 'email' },
  { key: 'emailInvites', label: 'Workspace invitations', group: 'email' },
  { key: 'inAppTasks', label: 'Task assignments & updates', group: 'inApp' },
  { key: 'inAppMentions', label: 'Mentions in comments & chat', group: 'inApp' },
  { key: 'inAppInvites', label: 'Workspace invitations', group: 'inApp' },
]

const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Search / command palette', alt: 'Ctrl+K' },
  { keys: ['⌘', 'J'], label: 'Open AI assistant', alt: 'Ctrl+J' },
  { keys: ['⌘', 'B'], label: 'Toggle sidebar', alt: 'Ctrl+B' },
  { keys: ['Esc'], label: 'Close dialogs and panels' },
  { keys: ['?'], label: 'Show keyboard shortcuts (this dialog)' },
] as const

const STUB_DEVICES = [
  {
    id: 'current',
    name: 'This device',
    browser: 'Current browser',
    location: 'Local session',
    lastActive: 'Now',
    current: true,
  },
  {
    id: 'macbook',
    name: 'MacBook Pro',
    browser: 'Chrome 128',
    location: 'Karachi, PK',
    lastActive: '2 hours ago',
    current: false,
  },
  {
    id: 'iphone',
    name: 'iPhone 15',
    browser: 'Safari Mobile',
    location: 'Karachi, PK',
    lastActive: 'Yesterday',
    current: false,
  },
] as const

export function SettingsPage() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAppSelector((s) => s.auth.user)
  const org = useAppSelector((s) => s.org.activeOrganization)
  const theme = useAppSelector((s) => s.ui.theme)
  const { can, canManageWorkspace } = usePermissions()
  const [displayName, setDisplayName] = useState(user?.name || '')
  const [uploading, setUploading] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(authApi.getLocalNotificationPreferences() || {}),
    ...(user?.notificationPreferences || {}),
  }))

  const sectionParam = searchParams.get('section') as SectionId | null
  const [section, setSection] = useState<SectionId>(sectionParam || 'profile')

  useEffect(() => {
    setDisplayName(user?.name || '')
  }, [user?.name])

  const goToSection = (id: SectionId) => {
    setSection(id)
    searchParams.set('section', id)
    setSearchParams(searchParams, { replace: true })
  }

  const rolesQuery = useQuery({
    queryKey: ['roles', org?.id],
    queryFn: () => orgApi.listRoles(org!.id),
    enabled: Boolean(org?.id) && can('org:update') && section === 'organization',
  })

  const orgForm = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    values: {
      name: org?.name || '',
      allowGuestInvites: org?.settings?.allowGuestInvites ?? true,
      defaultRoleSlug: org?.settings?.defaultRoleSlug || 'member',
    },
  })

  const orgMutation = useMutation({
    mutationFn: (values: OrgForm) =>
      orgApi.update(org!.id, {
        name: values.name,
        settings: {
          allowGuestInvites: values.allowGuestInvites,
          defaultRoleSlug: values.defaultRoleSlug,
        },
      }),
    onSuccess: async (result) => {
      dispatch(setActiveOrganization({ organization: result.organization }))
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Workspace updated')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateProfileMutation = useMutation({
    mutationFn: (input: { name?: string; avatarUrl?: string | null }) =>
      authApi.updateMe(input),
    onSuccess: (updatedUser) => {
      dispatch(setUser(updatedUser))
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const prefsMutation = useMutation({
    mutationFn: (next: NotificationPreferences) => authApi.updateMe({ notificationPreferences: next }),
    onSuccess: (updatedUser) => {
      dispatch(setUser(updatedUser))
      toast.success('Notification preferences saved')
    },
    onError: (_error, next) => {
      // Backend endpoint may not support this field yet — keep working via localStorage.
      authApi.setLocalNotificationPreferences(next)
      toast.success('Notification preferences saved on this device')
    },
  })

  const onAvatarChange = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await fileApi.upload(file)
      const avatarUrl = uploaded.secureUrl || uploaded.url
      const updatedUser = await authApi.updateMe({ avatarUrl })
      dispatch(setUser(updatedUser))
      toast.success('Avatar updated')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      prefsMutation.mutate(next)
      return next
    })
  }

  if (!org) {
    return <EmptyState title="Select a workspace" />
  }

  const sections: { id: SectionId; label: string; icon: typeof UserRound; show: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: UserRound, show: true },
    { id: 'appearance', label: 'Appearance', icon: Palette, show: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, show: true },
    { id: 'security', label: 'Security', icon: Shield, show: true },
    { id: 'organization', label: 'Organization', icon: Building2, show: can('org:update') },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Personal preferences for your account. Workspace admin lives under Admin."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Keyboard shortcuts</DialogTitle>
                <DialogDescription>
                  Quick actions across TeamSync AI. Use Ctrl instead of ⌘ on Windows/Linux.
                </DialogDescription>
              </DialogHeader>
              <ul className="divide-y divide-border">
                {KEYBOARD_SHORTCUTS.map((shortcut) => (
                  <li
                    key={shortcut.label}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <span>{shortcut.label}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {sections
            .filter((s) => s.show)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSection(s.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground',
                  section === s.id && 'bg-accent text-foreground',
                )}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {section === 'profile' ? (
            <>
              <div className="surface-panel flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.avatarUrl || undefined} alt="" />
                  <AvatarFallback className="text-lg">
                    {getInitials(user?.name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <div>
                    <Label htmlFor="avatar" className="mb-2 block">
                      Avatar
                    </Label>
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => void onAvatarChange(e.target.files?.[0])}
                    />
                  </div>
                </div>
              </div>

              <div className="surface-panel max-w-lg space-y-4 p-5">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <Button
                  disabled={updateProfileMutation.isPending}
                  onClick={() => {
                    if (!user) return
                    updateProfileMutation.mutate(
                      { name: displayName.trim() || user.name },
                      {
                        onSuccess: () => toast.success('Profile updated'),
                      },
                    )
                  }}
                >
                  {updateProfileMutation.isPending ? 'Saving…' : 'Save profile'}
                </Button>
              </div>

              {canManageWorkspace ? (
                <div className="surface-panel flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">Need members, roles, or invites?</p>
                    <p className="text-xs text-muted-foreground">
                      Workspace administration moved to the Admin area.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link to="/app/admin">Open Admin</Link>
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {section === 'appearance' ? (
            <div className="surface-panel max-w-lg space-y-4 p-5">
              <div>
                <h3 className="app-title text-sm">Theme</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose how TeamSync AI looks on this device.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => dispatch(setTheme('light'))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition hover:border-primary/40',
                    theme === 'light' && 'border-primary bg-primary/5',
                  )}
                >
                  <Sun className="h-5 w-5" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setTheme('dark'))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition hover:border-primary/40',
                    theme === 'dark' && 'border-primary bg-primary/5',
                  )}
                >
                  <Moon className="h-5 w-5" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
              </div>
            </div>
          ) : null}

          {section === 'notifications' ? (
            <div className="surface-panel max-w-lg space-y-5 p-5">
              <div>
                <h3 className="app-title text-sm">Notification preferences</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose what you get notified about. Changes save automatically.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                {NOTIF_ROWS.filter((r) => r.group === 'email').map((row) => (
                  <label key={row.key} className="flex items-center gap-2.5 text-sm">
                    <Checkbox checked={prefs[row.key]} onCheckedChange={() => togglePref(row.key)} />
                    {row.label}
                  </label>
                ))}
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  In-app
                </p>
                {NOTIF_ROWS.filter((r) => r.group === 'inApp').map((row) => (
                  <label key={row.key} className="flex items-center gap-2.5 text-sm">
                    <Checkbox checked={prefs[row.key]} onCheckedChange={() => togglePref(row.key)} />
                    {row.label}
                  </label>
                ))}
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Noise control
                </p>
                <label className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={prefs.mentionsOnly}
                    onCheckedChange={() => {
                      const next = { ...prefs, mentionsOnly: !prefs.mentionsOnly }
                      setPrefs(next)
                      prefsMutation.mutate(next)
                    }}
                  />
                  Mentions & invites only (mute other in-app noise)
                </label>
                <div className="space-y-2">
                  <Label>Email digest</Label>
                  <Select
                    value={prefs.digestFrequency}
                    onValueChange={(value) => {
                      const next = {
                        ...prefs,
                        digestFrequency: value as NotificationPreferences['digestFrequency'],
                      }
                      setPrefs(next)
                      prefsMutation.mutate(next)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="daily">Daily summary</SelectItem>
                      <SelectItem value="weekly">Weekly summary</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Digest emails are queued for the mail worker — preference is saved now.
                  </p>
                </div>
                {(prefs.mutedChannelIds?.length || 0) > 0 ? (
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs font-medium">Muted channels</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {prefs.mutedChannelIds.length} channel
                      {prefs.mutedChannelIds.length === 1 ? '' : 's'} muted from Chat. Unmute from
                      the channel header.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        const next = { ...prefs, mutedChannelIds: [] }
                        setPrefs(next)
                        prefsMutation.mutate(next)
                      }}
                    >
                      Clear all mutes
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Mute a channel from Chat → channel header to stop its notifications.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {section === 'security' ? (
            <div className="space-y-4">
              <div className="surface-panel max-w-lg space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <h3 className="app-title text-sm">Password</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password changes go through a secure reset link sent to your email.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/forgot-password">Send password reset link</Link>
                </Button>
              </div>
              <div className="surface-panel max-w-lg space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Laptop2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="app-title text-sm">Connected devices</h3>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Keyboard className="h-3 w-3" />
                        Shortcuts
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Keyboard shortcuts</DialogTitle>
                        <DialogDescription>
                          Use Ctrl instead of ⌘ on Windows/Linux.
                        </DialogDescription>
                      </DialogHeader>
                      <ul className="divide-y divide-border">
                        {KEYBOARD_SHORTCUTS.map((shortcut) => (
                          <li
                            key={shortcut.label}
                            className="flex items-center justify-between gap-4 py-2.5 text-sm"
                          >
                            <span>{shortcut.label}</span>
                            <div className="flex shrink-0 items-center gap-1">
                              {shortcut.keys.map((key) => (
                                <kbd
                                  key={key}
                                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </DialogContent>
                  </Dialog>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border text-sm">
                  {STUB_DEVICES.map((device) => (
                    <li
                      key={device.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {device.browser} · {device.location}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {device.current ? (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                            Active
                          </span>
                        ) : (
                          <>
                            <p className="text-[11px] text-muted-foreground">{device.lastActive}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-0.5 h-6 text-[11px] text-destructive"
                              onClick={() => toast.success('Session revoked (stub)')}
                            >
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Full session management with device fingerprinting is coming soon.
                </p>
              </div>
            </div>
          ) : null}

          {section === 'organization' && can('org:update') ? (
            <form
              className="surface-panel max-w-lg space-y-4 p-5"
              onSubmit={orgForm.handleSubmit((values) => orgMutation.mutate(values))}
            >
              <div className="space-y-2">
                <Label htmlFor="orgName">Workspace name</Label>
                <Input id="orgName" {...orgForm.register('name')} />
              </div>
              <div className="space-y-2">
                <Label>Default invite role</Label>
                <Select
                  value={orgForm.watch('defaultRoleSlug')}
                  onValueChange={(value) => orgForm.setValue('defaultRoleSlug', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(rolesQuery.data || [{ slug: 'member', name: 'Member' }]).map((role) => (
                      <SelectItem key={role.slug} value={role.slug}>
                        {role.name || role.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={orgForm.watch('allowGuestInvites')}
                  onCheckedChange={(checked) =>
                    orgForm.setValue('allowGuestInvites', Boolean(checked))
                  }
                />
                Allow guest invites
              </label>
              <Button type="submit" disabled={orgMutation.isPending}>
                {orgMutation.isPending ? 'Saving…' : 'Save workspace'}
              </Button>
              {canManageWorkspace ? (
                <p className="text-xs text-muted-foreground">
                  Branding, danger zone, and custom domain live under{' '}
                  <Link to="/app/admin" className="text-primary underline">
                    Admin → Workspace
                  </Link>
                  .
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
