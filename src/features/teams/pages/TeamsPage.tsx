import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { teamApi } from '@/services/teamApi'
import { orgApi } from '@/services/orgApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate, getErrorMessage, getInitials } from '@/utils/cn'
import type { Membership, User } from '@/types'

const teamSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().or(z.literal('')),
})

type TeamForm = z.infer<typeof teamSchema>

function memberUser(membership: Membership): User | null {
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

export function TeamsPage() {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [addMemberId, setAddMemberId] = useState('')
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const teamsQuery = useQuery({
    queryKey: ['teams', orgId],
    queryFn: () => teamApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && can('teams:read'),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(orgId),
  })

  const form = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: '', description: '' },
  })

  const teams = teamsQuery.data?.data.items ?? []
  const members = membersQuery.data ?? []
  const selectedTeam = teams.find((t) => t.id === selectedId) || null

  const usersById = useMemo(() => {
    const map = new Map<string, User>()
    for (const m of members) {
      const u = memberUser(m)
      if (u) map.set(u.id, u)
    }
    return map
  }, [members])

  const createMutation = useMutation({
    mutationFn: (values: TeamForm) =>
      teamApi.create({ name: values.name, description: values.description || undefined }),
    onSuccess: async () => {
      toast.success('Team created')
      setOpen(false)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['teams', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const removeMutation = useMutation({
    mutationFn: (teamId: string) => teamApi.remove(teamId),
    onSuccess: async () => {
      toast.success('Team deleted')
      setRemoveId(null)
      setSelectedId(null)
      await queryClient.invalidateQueries({ queryKey: ['teams', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMembersMutation = useMutation({
    mutationFn: ({ teamId, memberIds }: { teamId: string; memberIds: string[] }) =>
      teamApi.update(teamId, { memberIds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const addMember = () => {
    if (!selectedTeam || !addMemberId) return
    const next = Array.from(new Set([...selectedTeam.memberIds, addMemberId]))
    updateMembersMutation.mutate({ teamId: selectedTeam.id, memberIds: next })
    setAddMemberId('')
  }

  const removeMember = (userId: string) => {
    if (!selectedTeam) return
    const next = selectedTeam.memberIds.filter((id) => id !== userId)
    updateMembersMutation.mutate({ teamId: selectedTeam.id, memberIds: next })
  }

  if (!can('teams:read')) {
    return (
      <EmptyState
        title="No team access"
        description="Your role cannot view workspace teams."
      />
    )
  }

  const availableMembers = members
    .filter((m) => memberUser(m) && !selectedTeam?.memberIds.includes(memberUser(m)!.id))
    .map((m) => memberUser(m)!)

  return (
    <div>
      <PageHeader
        title="Teams"
        description="Group members into teams to organize projects and ownership."
        actions={
          can('teams:create') ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New team
            </Button>
          ) : null
        }
      />

      {!orgId ? (
        <EmptyState title="Select an organization" />
      ) : teamsQuery.isLoading ? (
        <LoadingState />
      ) : teamsQuery.isError ? (
        <ErrorState onRetry={() => void teamsQuery.refetch()} />
      ) : teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create a team to group members around a shared area of work."
          actionLabel={can('teams:create') ? 'Create team' : undefined}
          onAction={can('teams:create') ? () => setOpen(true) : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelectedId(team.id)}
              className="surface-panel group p-5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="app-title truncate text-base">{team.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {team.memberIds.length} member{team.memberIds.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover:bg-primary/15">
                  <Users className="h-3.5 w-3.5" />
                </span>
              </div>
              {team.description ? (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {team.description}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-muted-foreground/60">No description yet</p>
              )}
              <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                Updated {formatDate(team.updatedAt)}
              </p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="teamName">Name</Label>
              <Input id="teamName" {...form.register('name')} placeholder="Platform" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamDescription">Description</Label>
              <Textarea id="teamDescription" {...form.register('description')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selectedTeam)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedId(null)
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg">
          {selectedTeam ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTeam.name}</SheetTitle>
                <SheetDescription>
                  {selectedTeam.description || 'No description provided.'}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Members
                  </h3>
                  {selectedTeam.memberIds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedTeam.memberIds.map((userId) => {
                        const user = usersById.get(userId)
                        return (
                          <li
                            key={userId}
                            className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-accent/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={user?.avatarUrl || undefined} alt="" />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(user?.name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-sm">
                                {user?.name || user?.email || userId}
                              </span>
                            </div>
                            {can('teams:update') ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeMember(userId)}
                                aria-label="Remove member"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {can('teams:update') ? (
                  <section className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Add member
                    </h3>
                    <div className="flex gap-2">
                      <Select value={addMemberId} onValueChange={setAddMemberId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMembers.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Everyone is already in this team
                            </div>
                          ) : (
                            availableMembers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name || user.email}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!addMemberId || updateMembersMutation.isPending}
                        onClick={addMember}
                      >
                        Add
                      </Button>
                    </div>
                  </section>
                ) : null}

                {can('teams:delete') ? (
                  <div className="border-t border-border pt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRemoveId(selectedTeam.id)}
                    >
                      Delete team
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(isOpen) => !isOpen && setRemoveId(null)}
        title="Delete team?"
        description="Members will lose this team grouping. Projects keep their own membership."
        confirmLabel="Delete"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />
    </div>
  )
}
