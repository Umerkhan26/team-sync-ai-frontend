import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Globe2,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { orgApi } from '@/services/orgApi'
import { auditApi } from '@/services/auditApi'
import { fileApi } from '@/services/fileApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveOrganization } from '@/store/orgSlice'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage, getInitials, formatDateTime } from '@/utils/cn'
import type { CompanySize, Membership, Role, User } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BulkInviteDialog, type BulkInviteRow } from '@/features/admin/components/BulkInviteDialog'
import { RoleFormDialog } from '@/features/admin/components/RoleFormDialog'
import { MemberDetailDrawer } from '@/features/admin/components/MemberDetailDrawer'

const inviteSchema = z.object({
  email: z.string().email(),
  inviteeName: z.string().max(100).optional().or(z.literal('')),
  department: z.string().max(80).optional().or(z.literal('')),
  roleSlug: z.string().min(1).optional(),
})

type InviteForm = z.infer<typeof inviteSchema>

const orgSchema = z.object({
  name: z.string().min(1).max(120),
  logoUrl: z.string().max(1000).optional().or(z.literal('')),
  industry: z.string().max(80).optional().or(z.literal('')),
  companySize: z.string().optional().or(z.literal('')),
  country: z.string().max(80).optional().or(z.literal('')),
  website: z.string().max(300).optional().or(z.literal('')),
  timezone: z.string().max(80).optional().or(z.literal('')),
  locale: z.string().max(20).optional().or(z.literal('')),
  accentColor: z.string().max(20).optional().or(z.literal('')),
  allowGuestInvites: z.boolean(),
  defaultRoleSlug: z.string().min(1),
})

type OrgForm = z.infer<typeof orgSchema>

const COMPANY_SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+']

const SSO_PROVIDERS = ['Okta', 'Google Workspace', 'Microsoft Entra ID', 'OneLogin'] as const

function ipAllowlistKey(orgId: string) {
  return `teamsync_ip_allowlist_${orgId}`
}

function loadIpAllowlist(orgId: string): string {
  try {
    return localStorage.getItem(ipAllowlistKey(orgId)) || ''
  } catch {
    return ''
  }
}

function exportMembersCsv(
  members: Membership[],
  labelFn: (m: Membership) => string,
  emailFn: (m: Membership) => string,
  roleFn: (m: Membership) => string,
) {
  const header = ['Name', 'Email', 'Role', 'Status']
  const rows = members.map((m) => [
    labelFn(m),
    emailFn(m),
    roleFn(m),
    m.status,
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function inviteBadge(invite: { status: string; expiresAt?: string }) {
  const status = invite.status?.toLowerCase()
  if (status === 'revoked') return { label: 'Revoked', variant: 'destructive' as const }
  if (status === 'accepted') return { label: 'Accepted', variant: 'success' as const }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now() && status !== 'accepted') {
    return { label: 'Expired', variant: 'warning' as const }
  }
  return { label: 'Pending', variant: 'secondary' as const }
}

export function AdminPage() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const org = useAppSelector((s) => s.org.activeOrganization)
  const user = useAppSelector((s) => s.auth.user)
  const { can, canManageWorkspace, roleName, isOwner } = usePermissions()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleDeleteId, setRoleDeleteId] = useState<string | null>(null)
  const [inviteRevokeId, setInviteRevokeId] = useState<string | null>(null)
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false)
  const [transferUserId, setTransferUserId] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [detailMembership, setDetailMembership] = useState<Membership | null>(null)
  const [ssoStep, setSsoStep] = useState(0)
  const [ssoProvider, setSsoProvider] = useState<string>(SSO_PROVIDERS[0])
  const [ssoDomain, setSsoDomain] = useState('')
  const [ipAllowlist, setIpAllowlist] = useState(() =>
    org?.id ? loadIpAllowlist(org.id) : '',
  )

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (org?.id) setIpAllowlist(loadIpAllowlist(org.id))
  }, [org?.id])

  const membersQuery = useQuery({
    queryKey: ['members', org?.id],
    queryFn: () => orgApi.listMembers(org!.id),
    enabled: Boolean(org?.id) && can('members:read'),
  })

  const invitationsQuery = useQuery({
    queryKey: ['invitations', org?.id],
    queryFn: () => orgApi.listInvitations(org!.id),
    enabled: Boolean(org?.id) && can('members:invite'),
  })

  const rolesQuery = useQuery({
    queryKey: ['roles', org?.id],
    queryFn: () => orgApi.listRoles(org!.id),
    enabled: Boolean(org?.id) && can('roles:read'),
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', org?.id],
    queryFn: () => auditApi.list({ limit: 50 }),
    enabled: Boolean(org?.id) && can('audit:read'),
  })

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', inviteeName: '', department: '', roleSlug: 'member' },
  })

  const orgForm = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    values: {
      name: org?.name || '',
      logoUrl: org?.logoUrl || '',
      industry: org?.industry || '',
      companySize: org?.companySize || '',
      country: org?.country || '',
      website: org?.website || '',
      timezone: org?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      locale: org?.locale || 'en',
      accentColor: org?.accentColor || '#1B4F72',
      allowGuestInvites: org?.settings?.allowGuestInvites ?? true,
      defaultRoleSlug: org?.settings?.defaultRoleSlug || 'member',
    },
  })

  const inviteMutation = useMutation({
    mutationFn: (values: InviteForm) =>
      orgApi.invite(org!.id, {
        email: values.email,
        roleSlug: values.roleSlug || undefined,
        inviteeName: values.inviteeName || undefined,
        department: values.department || undefined,
      }),
    onSuccess: async (result) => {
      toast.success('Invitation sent — they create their own password')
      if (result.token) setInviteToken(result.token)
      inviteForm.reset({ email: '', inviteeName: '', department: '', roleSlug: 'member' })
      await queryClient.invalidateQueries({ queryKey: ['invitations', org?.id] })
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      const refreshed = await orgApi.get(org!.id)
      dispatch(setActiveOrganization({ organization: refreshed.organization }))
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const orgMutation = useMutation({
    mutationFn: (values: OrgForm) =>
      orgApi.update(org!.id, {
        name: values.name,
        logoUrl: values.logoUrl || null,
        industry: values.industry || null,
        companySize: values.companySize || null,
        country: values.country || null,
        website: values.website || null,
        timezone: values.timezone || undefined,
        locale: values.locale || undefined,
        accentColor: values.accentColor || null,
        settings: {
          allowGuestInvites: values.allowGuestInvites,
          defaultRoleSlug: values.defaultRoleSlug,
        },
      }),
    onSuccess: async (result) => {
      dispatch(setActiveOrganization({ organization: result.organization }))
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Workspace settings saved')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteOrgMutation = useMutation({
    mutationFn: () => orgApi.remove(org!.id),
    onSuccess: async () => {
      toast.success('Organization deleted')
      setDeleteOrgOpen(false)
      dispatch(setActiveOrganization({ organization: null, membership: null }))
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      window.location.href = '/onboarding'
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not delete organization')),
  })

  const transferMutation = useMutation({
    mutationFn: (newOwnerUserId: string) => orgApi.transferOwnership(org!.id, newOwnerUserId),
    onSuccess: async () => {
      toast.success('Ownership transferred')
      setTransferOpen(false)
      setTransferUserId('')
      await queryClient.invalidateQueries({ queryKey: ['members', org?.id] })
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      window.location.reload()
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not transfer ownership')),
  })

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => orgApi.removeMember(org!.id, membershipId),
    onSuccess: async () => {
      setRemoveId(null)
      setDetailMembership(null)
      toast.success('Member removed')
      await queryClient.invalidateQueries({ queryKey: ['members', org?.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMemberMutation = useMutation({
    mutationFn: ({
      membershipId,
      roleSlug,
      status,
    }: {
      membershipId: string
      roleSlug?: string
      status?: 'active' | 'suspended'
    }) => orgApi.updateMember(org!.id, membershipId, { roleSlug, status }),
    onSuccess: async (_result, variables) => {
      toast.success(variables.status ? `Member ${variables.status}` : 'Role updated')
      await queryClient.invalidateQueries({ queryKey: ['members', org?.id] })
      setDetailMembership((prev) =>
        prev && prev.id === variables.membershipId
          ? { ...prev, status: variables.status || prev.status }
          : prev,
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => orgApi.revokeInvite(org!.id, inviteId),
    onSuccess: async () => {
      toast.success('Invitation revoked')
      setInviteRevokeId(null)
      await queryClient.invalidateQueries({ queryKey: ['invitations', org?.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not revoke invite (backend endpoint pending)')),
  })

  const resendInviteMutation = useMutation({
    mutationFn: (inviteId: string) => orgApi.resendInvite(org!.id, inviteId),
    onSuccess: async (result) => {
      toast.success('Invitation resent')
      if (result.token) setInviteToken(result.token)
      await queryClient.invalidateQueries({ queryKey: ['invitations', org?.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not resend invite (backend endpoint pending)')),
  })

  const bulkInviteMutation = useMutation({
    mutationFn: (rows: BulkInviteRow[]) =>
      orgApi.bulkInvite(
        org!.id,
        rows.map((row) => ({
          email: row.email,
          inviteeName: row.name,
          roleSlug: row.roleSlug,
          department: row.department,
        })),
      ),
    onSuccess: async (result) => {
      setBulkOpen(false)
      const failed = result.results.filter((r) => !r.ok)
      if (failed.length > 0) {
        toast.warning(`${result.invited} invited, ${failed.length} failed`)
      } else {
        toast.success(`${result.invited} invitation${result.invited === 1 ? '' : 's'} sent`)
      }
      await queryClient.invalidateQueries({ queryKey: ['invitations', org?.id] })
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const createRoleMutation = useMutation({
    mutationFn: (values: { name: string; description?: string; permissions: string[] }) =>
      orgApi.createRole(org!.id, values),
    onSuccess: async () => {
      toast.success('Role created')
      setRoleDialogOpen(false)
      setEditingRole(null)
      await queryClient.invalidateQueries({ queryKey: ['roles', org?.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateRoleMutation = useMutation({
    mutationFn: (values: { name: string; description?: string; permissions: string[] }) =>
      orgApi.updateRole(org!.id, editingRole!.id, values),
    onSuccess: async () => {
      toast.success('Role updated')
      setRoleDialogOpen(false)
      setEditingRole(null)
      await queryClient.invalidateQueries({ queryKey: ['roles', org?.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => orgApi.deleteRole(org!.id, roleId),
    onSuccess: async () => {
      toast.success('Role deleted')
      setRoleDeleteId(null)
      await queryClient.invalidateQueries({ queryKey: ['roles', org?.id] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not delete role')),
  })

  const memberLabel = (membership: Membership) => {
    const u = membership.userId
    if (typeof u === 'object' && u) return (u as User).name || (u as User).email
    return String(u)
  }

  const memberEmail = (membership: Membership) => {
    const u = membership.userId
    if (typeof u === 'object' && u) return (u as User).email
    return ''
  }

  const roleSlugOf = (membership: Membership) => {
    const role = membership.roleId
    if (typeof role === 'object' && role) return role.slug
    return rolesQuery.data?.find((r) => r.id === role)?.slug || 'member'
  }

  const filteredMembers = useMemo(() => {
    const list = membersQuery.data || []
    const q = search.trim().toLowerCase()
    return list.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (roleFilter !== 'all' && roleSlugOf(m) !== roleFilter) return false
      if (q) {
        const hay = `${memberLabel(m)} ${memberEmail(m)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersQuery.data, search, roleFilter, statusFilter, rolesQuery.data])

  const onLogoChange = async (file?: File | null) => {
    if (!file) return
    setLogoUploading(true)
    try {
      const uploaded = await fileApi.upload(file)
      orgForm.setValue('logoUrl', uploaded.secureUrl || uploaded.url, { shouldDirty: true })
      toast.success('Logo uploaded — save to apply')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Logo upload failed'))
    } finally {
      setLogoUploading(false)
    }
  }

  if (!canManageWorkspace) {
    return <Navigate to="/app/settings" replace />
  }

  if (!org) {
    return <EmptyState title="Select a workspace" />
  }

  const saveIpAllowlist = () => {
    localStorage.setItem(ipAllowlistKey(org.id), ipAllowlist)
    toast.success('IP allowlist saved locally')
  }

  const hasFilters = search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all'
  const totalMembers = membersQuery.data?.length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Admin"
        description={`Workspace controls for ${org.name}. You are signed in as ${roleName}.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/settings">Personal settings</Link>
          </Button>
        }
      />

      <Tabs defaultValue="members">
        <TabsList>
          {can('members:read') ? <TabsTrigger value="members">Members</TabsTrigger> : null}
          {can('org:update') ? <TabsTrigger value="workspace">Workspace</TabsTrigger> : null}
          {can('roles:read') ? <TabsTrigger value="roles">Roles</TabsTrigger> : null}
          {can('audit:read') ? <TabsTrigger value="audit">Audit</TabsTrigger> : null}
        </TabsList>

        {can('members:read') ? (
          <TabsContent value="members" className="space-y-6">
            {can('members:invite') ? (
              <form
                className="surface-panel max-w-2xl space-y-4 p-5"
                onSubmit={inviteForm.handleSubmit((values) => inviteMutation.mutate(values))}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="app-title text-sm">Invite teammate</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sends a secure link. No passwords are emailed — they set one on accept.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkOpen(true)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Bulk invite
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="inviteName">Name</Label>
                    <Input
                      id="inviteName"
                      placeholder="Alex Chen"
                      {...inviteForm.register('inviteeName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">Email</Label>
                    <Input
                      id="inviteEmail"
                      placeholder="alex@company.com"
                      type="email"
                      {...inviteForm.register('email')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteForm.watch('roleSlug') || 'member'}
                      onValueChange={(value) => inviteForm.setValue('roleSlug', value)}
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
                  <div className="space-y-2">
                    <Label htmlFor="inviteDept">Department</Label>
                    <Input
                      id="inviteDept"
                      placeholder="Engineering"
                      {...inviteForm.register('department')}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
                </Button>
                {inviteToken ? (
                  <p className="break-all rounded-md bg-secondary p-3 text-xs">
                    Dev invite link:{' '}
                    <Link
                      className="text-primary underline"
                      to={`/invitations/accept?token=${inviteToken}`}
                    >
                      /invitations/accept?token=…
                    </Link>
                    <span className="mt-1 block text-muted-foreground">{inviteToken}</span>
                  </p>
                ) : null}
              </form>
            ) : null}

            {totalMembers > 0 ? (
              <div className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2.5 backdrop-blur">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {(rolesQuery.data || []).map((role) => (
                      <SelectItem key={role.slug} value={role.slug}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                {hasFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSearch('')
                      setRoleFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    exportMembersCsv(
                      filteredMembers,
                      memberLabel,
                      memberEmail,
                      roleSlugOf,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <span className="text-xs text-muted-foreground">
                  {filteredMembers.length} of {totalMembers}
                </span>
              </div>
            ) : null}

            {membersQuery.isLoading ? (
              <LoadingState rows={4} />
            ) : membersQuery.isError ? (
              <ErrorState onRetry={() => void membersQuery.refetch()} />
            ) : totalMembers === 0 ? (
              <EmptyState
                title="No users yet — invite your first teammate"
                description="Send an invitation above to bring your team into this workspace."
              />
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                title="No members match your filters"
                description="Try a different search term or clear the filters."
              />
            ) : (
              <ul className="surface-panel divide-y divide-border overflow-hidden">
                {filteredMembers.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-3 text-left"
                      onClick={() => setDetailMembership(membership)}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={
                            typeof membership.userId === 'object'
                              ? membership.userId.avatarUrl || undefined
                              : undefined
                          }
                          alt=""
                        />
                        <AvatarFallback>{getInitials(memberLabel(membership))}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium hover:underline">
                          {memberLabel(membership)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{memberEmail(membership)}</p>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={membership.status === 'active' ? 'success' : 'warning'} className="capitalize">
                        {membership.status}
                      </Badge>
                      {can('members:update') ? (
                        <Select
                          value={roleSlugOf(membership)}
                          onValueChange={(value) =>
                            updateMemberMutation.mutate({
                              membershipId: membership.id,
                              roleSlug: value,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(rolesQuery.data || []).map((role) => (
                              <SelectItem key={role.slug} value={role.slug}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="capitalize">
                          {roleSlugOf(membership)}
                        </Badge>
                      )}
                      {can('members:update') ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateMemberMutation.mutate({
                              membershipId: membership.id,
                              status: membership.status === 'active' ? 'suspended' : 'active',
                            })
                          }
                        >
                          {membership.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      ) : null}
                      {can('members:remove') ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setRemoveId(membership.id)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {can('members:invite') ? (
              <div className="space-y-2">
                <h3 className="app-title text-sm">Invitations</h3>
                {(invitationsQuery.data?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
                ) : (
                  <ul className="surface-panel divide-y divide-border">
                    {invitationsQuery.data!.map((invite) => {
                      const badge = inviteBadge(invite)
                      const pending = badge.label === 'Pending' || badge.label === 'Expired'
                      return (
                        <li
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {invite.inviteeName || invite.email}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {invite.email}
                              {invite.department ? ` · ${invite.department}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            {pending ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Resend invitation"
                                  disabled={resendInviteMutation.isPending}
                                  onClick={() => resendInviteMutation.mutate(invite.id)}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Revoke invitation"
                                  className="text-destructive"
                                  onClick={() => setInviteRevokeId(invite.id)}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </TabsContent>
        ) : null}

        {can('org:update') ? (
          <TabsContent value="workspace" className="space-y-6">
            <form
              className="surface-panel max-w-2xl space-y-5 p-5"
              onSubmit={orgForm.handleSubmit((values) => orgMutation.mutate(values))}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {orgForm.watch('logoUrl') ? (
                    <img
                      src={orgForm.watch('logoUrl')}
                      alt="Workspace logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Globe2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void onLogoChange(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading ? 'Uploading…' : 'Upload logo'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG or SVG, square works best.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="orgName">Workspace name</Label>
                  <Input id="orgName" {...orgForm.register('name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" {...orgForm.register('industry')} placeholder="Software" />
                </div>
                <div className="space-y-2">
                  <Label>Company size</Label>
                  <Select
                    value={orgForm.watch('companySize') || undefined}
                    onValueChange={(value) => orgForm.setValue('companySize', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size} employees
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...orgForm.register('country')} placeholder="Pakistan" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" {...orgForm.register('website')} placeholder="https://company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" {...orgForm.register('timezone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">Language</Label>
                  <Input id="locale" {...orgForm.register('locale')} placeholder="en" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="accentColor"
                      type="color"
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                      {...orgForm.register('accentColor')}
                    />
                    <Input
                      value={orgForm.watch('accentColor') || ''}
                      onChange={(e) => orgForm.setValue('accentColor', e.target.value)}
                      className="w-28 font-mono text-xs"
                    />
                  </div>
                </div>
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
              <p className="text-xs text-muted-foreground">
                Billing and feature flags are reserved for Phase 2 — schema already supports plans.
              </p>
              <Button type="submit" disabled={orgMutation.isPending}>
                {orgMutation.isPending ? 'Saving…' : 'Save workspace'}
              </Button>
            </form>

            <div className="surface-panel max-w-2xl space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="app-title text-sm">Custom domain</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Serve TeamSync AI from your own domain, e.g. teamsync.acme.com.
                  </p>
                </div>
                <Badge variant="secondary">Coming soon</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { step: 1, title: 'Add DNS record', desc: 'Point a CNAME to app.teamsync.ai' },
                  { step: 2, title: 'Verify domain', desc: 'We confirm DNS propagation' },
                  { step: 3, title: 'Activate SSL', desc: 'Certificate issued automatically' },
                ].map((s) => (
                  <div
                    key={s.step}
                    className="cursor-not-allowed rounded-lg border border-dashed border-border p-3 opacity-60"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {s.step}
                    </span>
                    <p className="mt-2 text-xs font-medium">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                  </div>
                ))}
              </div>
              <Input disabled placeholder="teamsync.acme.com" />
            </div>

            <div className="surface-panel max-w-2xl space-y-4 p-5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="app-title text-sm">SSO setup</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure SAML/OIDC for your identity provider — stub wizard for MVP.
                  </p>
                </div>
              </div>

              <ol className="flex gap-2">
                {(['Provider', 'Domain', 'Test'] as const).map((label, i) => (
                  <li
                    key={label}
                    className={`flex flex-1 items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs ${
                      ssoStep === i
                        ? 'border-primary bg-primary/5 font-medium'
                        : ssoStep > i
                          ? 'border-success/40 text-success'
                          : 'border-border text-muted-foreground'
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {ssoStep > i ? '✓' : i + 1}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>

              {ssoStep === 0 ? (
                <div className="space-y-3">
                  <Label>Identity provider</Label>
                  <Select value={ssoProvider} onValueChange={setSsoProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SSO_PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => setSsoStep(1)}>
                    Continue
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}

              {ssoStep === 1 ? (
                <div className="space-y-3">
                  <Label htmlFor="ssoDomain">Email domain</Label>
                  <Input
                    id="ssoDomain"
                    placeholder="acme.com"
                    value={ssoDomain}
                    onChange={(e) => setSsoDomain(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Users with @{ssoDomain || 'your-domain.com'} will sign in via {ssoProvider}.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSsoStep(0)}>
                      Back
                    </Button>
                    <Button size="sm" disabled={!ssoDomain.trim()} onClick={() => setSsoStep(2)}>
                      Continue
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {ssoStep === 2 ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                    <p className="mt-2 text-sm font-medium">Test connection</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Simulated handshake with {ssoProvider} for {ssoDomain}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => toast.success('SSO test passed (stub) — production SAML coming soon')}
                  >
                    Run test login
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSsoStep(1)}>
                    Back
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="surface-panel max-w-2xl space-y-4 p-5">
              <div>
                <h3 className="app-title text-sm">IP allowlist</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Restrict admin access to specific IPs or CIDR ranges. Saved locally for MVP.
                </p>
              </div>
              <Textarea
                rows={4}
                placeholder={'203.0.113.0/24\n198.51.100.42\n10.0.0.0/8'}
                value={ipAllowlist}
                onChange={(e) => setIpAllowlist(e.target.value)}
                className="font-mono text-xs"
              />
              <Button size="sm" onClick={saveIpAllowlist}>
                Save allowlist
              </Button>
            </div>

            {isOwner ? (
              <div className="max-w-2xl space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <h3 className="app-title text-sm">Danger zone</h3>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
                  <p className="text-sm font-medium text-foreground">Transfer ownership</p>
                  <p className="text-xs text-muted-foreground">
                    Hand the workspace to another active member. You become an Admin after transfer.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={transferUserId} onValueChange={setTransferUserId}>
                      <SelectTrigger className="sm:max-w-xs">
                        <SelectValue placeholder="Select new owner…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(membersQuery.data || [])
                          .map((m) => ({
                            membership: m,
                            user: typeof m.userId === 'object' ? (m.userId as User) : null,
                          }))
                          .filter((row) => row.user && row.user.id !== user?.id)
                          .map((row) => (
                            <SelectItem key={row.membership.id} value={row.user!.id}>
                              {row.user!.name} ({row.user!.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!transferUserId}
                      onClick={() => setTransferOpen(true)}
                    >
                      Transfer…
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Deleting the organization permanently removes all projects, tasks, documents, and
                  members. This cannot be undone.
                </p>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOrgOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete organization
                </Button>
              </div>
            ) : null}
          </TabsContent>
        ) : null}

        {can('roles:read') ? (
          <TabsContent value="roles" className="space-y-4">
            {can('roles:manage') ? (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRole(null)
                    setRoleDialogOpen(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New role
                </Button>
              </div>
            ) : null}
            {rolesQuery.isLoading ? (
              <LoadingState rows={3} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(rolesQuery.data || []).map((role) => (
                  <div key={role.id} className="surface-panel p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {role.name}
                        {role.isSystem ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              System role — permissions are fixed and cannot be deleted.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="capitalize">
                          {role.slug}
                        </Badge>
                        {can('roles:manage') && !role.isSystem ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditingRole(role)
                                setRoleDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => setRoleDeleteId(role.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {role.permissions.length} permissions
                      {role.isSystem ? ' · system role' : ' · custom role'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {role.permissions.slice(0, 8).map((p) => (
                        <Badge key={p} variant="secondary" className="text-[10px] font-normal">
                          {p}
                        </Badge>
                      ))}
                      {role.permissions.length > 8 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          +{role.permissions.length - 8}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ) : null}

        {can('audit:read') ? (
          <TabsContent value="audit">
            {auditQuery.isLoading ? (
              <LoadingState rows={5} />
            ) : auditQuery.isError ? (
              <ErrorState onRetry={() => void auditQuery.refetch()} />
            ) : (auditQuery.data?.data.items.length || 0) === 0 ? (
              <EmptyState title="No audit activity yet" description="Actions across your workspace will appear here." />
            ) : (
              <ul className="surface-panel divide-y divide-border overflow-hidden">
                {auditQuery.data!.data.items.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {log.action}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          on {log.resource}
                          {log.resourceId ? ` #${log.resourceId.slice(-6)}` : ''}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeof log.actorId === 'object' && log.actorId
                          ? (log.actorId as User).name
                          : 'System'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ) : null}
      </Tabs>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title="Remove member?"
        description="They will lose access to this workspace immediately."
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />

      <ConfirmDialog
        open={Boolean(inviteRevokeId)}
        onOpenChange={(open) => !open && setInviteRevokeId(null)}
        title="Revoke invitation?"
        description="The invite link will stop working immediately."
        confirmLabel="Revoke"
        destructive
        loading={revokeInviteMutation.isPending}
        onConfirm={() => inviteRevokeId && revokeInviteMutation.mutate(inviteRevokeId)}
      />

      <ConfirmDialog
        open={Boolean(roleDeleteId)}
        onOpenChange={(open) => !open && setRoleDeleteId(null)}
        title="Delete role?"
        description="Members assigned this role will need to be reassigned. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteRoleMutation.isPending}
        onConfirm={() => roleDeleteId && deleteRoleMutation.mutate(roleDeleteId)}
      />

      <ConfirmDialog
        open={deleteOrgOpen}
        onOpenChange={setDeleteOrgOpen}
        title={`Delete ${org.name}?`}
        description="This permanently deletes the organization, all projects, tasks, documents, files, and removes every member. This cannot be undone."
        confirmLabel="Delete organization"
        destructive
        loading={deleteOrgMutation.isPending}
        onConfirm={() => deleteOrgMutation.mutate()}
      />

      <ConfirmDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Transfer ownership?"
        description="You will become an Admin. The selected member becomes Owner and gains full control of this workspace."
        confirmLabel="Transfer ownership"
        loading={transferMutation.isPending}
        onConfirm={() => transferUserId && transferMutation.mutate(transferUserId)}
      />

      <BulkInviteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        loading={bulkInviteMutation.isPending}
        onSubmit={(rows) => bulkInviteMutation.mutate(rows)}
      />

      <RoleFormDialog
        open={roleDialogOpen}
        onOpenChange={(open) => {
          setRoleDialogOpen(open)
          if (!open) setEditingRole(null)
        }}
        role={editingRole}
        loading={createRoleMutation.isPending || updateRoleMutation.isPending}
        onSubmit={(values) =>
          editingRole ? updateRoleMutation.mutate(values) : createRoleMutation.mutate(values)
        }
      />

      <MemberDetailDrawer
        membership={detailMembership}
        onOpenChange={(open) => !open && setDetailMembership(null)}
        roles={rolesQuery.data || []}
        canManage={can('members:update')}
        suspendPending={updateMemberMutation.isPending}
        onSuspend={(id) => updateMemberMutation.mutate({ membershipId: id, status: 'suspended' })}
        onActivate={(id) => updateMemberMutation.mutate({ membershipId: id, status: 'active' })}
        onRemove={(id) => setRemoveId(id)}
      />
    </div>
  )
}
