import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Target, Users, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { teamApi } from '@/services/teamApi'
import { orgApi } from '@/services/orgApi'
import { taskApi } from '@/services/taskApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { cn, formatDate, getErrorMessage, getInitials } from '@/utils/cn'
import type { Membership, Task, Team, User } from '@/types'

const teamSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().or(z.literal('')),
})

type TeamForm = z.infer<typeof teamSchema>

function memberUser(membership: Membership): User | null {
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

function teamGoalKey(teamId: string) {
  return `ts_team_goal_${teamId}`
}

function loadTeamGoal(teamId: string): string {
  try {
    return localStorage.getItem(teamGoalKey(teamId)) || ''
  } catch {
    return ''
  }
}

function saveTeamGoal(teamId: string, goal: string) {
  localStorage.setItem(teamGoalKey(teamId), goal)
}

function clearTeamGoal(teamId: string) {
  localStorage.removeItem(teamGoalKey(teamId))
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekDays(): Date[] {
  const start = startOfWeek(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function taskDueDay(task: Task): Date | null {
  if (!task.dueDate) return null
  const d = new Date(task.dueDate)
  return Number.isNaN(d.getTime()) ? null : d
}

function heatLevel(count: number): string {
  if (count === 0) return 'bg-muted/50'
  if (count === 1) return 'bg-primary/20'
  if (count === 2) return 'bg-primary/40'
  if (count === 3) return 'bg-primary/60'
  return 'bg-primary/80'
}

function teamCapacityUsed(team: Team): number {
  return team.memberIds.length
}

const TEAM_CAPACITY_MAX = 10

export function TeamsPage() {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [addMemberId, setAddMemberId] = useState('')
  const [goalDraft, setGoalDraft] = useState('')
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

  const tasksQuery = useQuery({
    queryKey: ['tasks', orgId, 'teams-heatmap'],
    queryFn: () => taskApi.list({ limit: 200 }),
    enabled: Boolean(orgId) && can('tasks:read'),
  })

  const form = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: '', description: '' },
  })

  const teams = teamsQuery.data?.data.items ?? []
  const members = membersQuery.data ?? []
  const allTasks = tasksQuery.data?.data.items ?? []
  const days = useMemo(() => weekDays(), [])
  const selectedTeam = teams.find((t) => t.id === selectedId) || null

  useEffect(() => {
    if (!selectedTeam) {
      setGoalDraft('')
      return
    }
    setGoalDraft(loadTeamGoal(selectedTeam.id))
  }, [selectedTeam?.id])

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

  const teamTasks = useMemo(() => {
    if (!selectedTeam) return allTasks
    return allTasks.filter((t) => t.assigneeIds.some((id) => selectedTeam.memberIds.includes(id)))
  }, [allTasks, selectedTeam])

  const heatmapRows = useMemo(() => {
    if (!selectedTeam) return []
    const rows = selectedTeam.memberIds.map((userId) => {
      const user = usersById.get(userId)
      const counts = days.map((day) => {
        return teamTasks.filter((task) => {
          const due = taskDueDay(task)
          return due ? sameDay(due, day) && task.assigneeIds.includes(userId) : false
        }).length
      })
      return { userId, user, counts }
    })
    if (rows.length > 0) return rows
    return days[0]
      ? [
          {
            userId: 'placeholder',
            user: null,
            counts: days.map(() => 0),
          },
        ]
      : []
  }, [selectedTeam, usersById, days, teamTasks])

  const saveGoal = () => {
    if (!selectedTeam) return
    const trimmed = goalDraft.trim()
    if (trimmed) {
      saveTeamGoal(selectedTeam.id, trimmed)
      toast.success('Team goal saved')
    } else {
      clearTeamGoal(selectedTeam.id)
      toast.success('Team goal cleared')
    }
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
        eyebrow="People"
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
          {teams.map((team) => {
            const used = teamCapacityUsed(team)
            const pct = Math.min(100, Math.round((used / TEAM_CAPACITY_MAX) * 100))
            const capacityTone =
              pct >= 85 ? 'bg-destructive' : pct >= 60 ? 'bg-amber-500' : 'bg-primary'
            return (
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
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Capacity</span>
                  <span className="tabular-nums font-medium">
                    {used} / {TEAM_CAPACITY_MAX}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', capacityTone)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {loadTeamGoal(team.id) ? (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Target className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span className="line-clamp-1">{loadTeamGoal(team.id)}</span>
                </p>
              ) : null}
              <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                Updated {formatDate(team.updatedAt)}
              </p>
            </button>
            )
          })}
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
                    Team goal
                  </h3>
                  <div className="space-y-2">
                    <Textarea
                      value={goalDraft}
                      onChange={(e) => setGoalDraft(e.target.value)}
                      placeholder="One goal for this team this quarter…"
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveGoal}>
                        Save goal
                      </Button>
                      {goalDraft.trim() ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGoalDraft('')
                            if (selectedTeam) clearTeamGoal(selectedTeam.id)
                            toast.success('Team goal cleared')
                          }}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Workload heatmap
                  </h3>
                  {!can('tasks:read') ? (
                    <p className="text-xs text-muted-foreground">
                      Task access required to show workload data.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border p-3">
                      <div className="mb-2 grid grid-cols-[minmax(80px,1fr)_repeat(7,minmax(28px,1fr))] gap-1 text-[10px] font-medium text-muted-foreground">
                        <span>Member</span>
                        {days.map((day, i) => (
                          <span key={i} className="text-center">
                            {WEEKDAY_LABELS[i]}
                            <br />
                            <span className="font-normal">{day.getDate()}</span>
                          </span>
                        ))}
                      </div>
                      {heatmapRows.map((row) => (
                        <div
                          key={row.userId}
                          className="mb-1 grid grid-cols-[minmax(80px,1fr)_repeat(7,minmax(28px,1fr))] items-center gap-1"
                        >
                          <span className="truncate text-xs">
                            {row.user?.name || row.user?.email || 'Unassigned'}
                          </span>
                          {row.counts.map((count, i) => (
                            <span
                              key={i}
                              title={`${count} task${count === 1 ? '' : 's'} due`}
                              className={cn(
                                'mx-auto flex h-7 w-7 items-center justify-center rounded text-[10px] font-medium tabular-nums',
                                heatLevel(count),
                                count > 0 && 'text-primary-foreground',
                              )}
                            >
                              {count > 0 ? count : ''}
                            </span>
                          ))}
                        </div>
                      ))}
                      {selectedTeam.memberIds.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Add members to see workload by assignee.
                        </p>
                      ) : null}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Capacity
                    <Badge variant="secondary" className="tabular-nums normal-case">
                      {selectedTeam
                        ? `${teamCapacityUsed(selectedTeam)} / ${TEAM_CAPACITY_MAX}`
                        : `0 / ${TEAM_CAPACITY_MAX}`}
                    </Badge>
                  </h3>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (() => {
                          const pct = selectedTeam
                            ? Math.min(
                                100,
                                Math.round((teamCapacityUsed(selectedTeam) / TEAM_CAPACITY_MAX) * 100),
                              )
                            : 0
                          return pct >= 85
                            ? 'bg-destructive'
                            : pct >= 60
                              ? 'bg-amber-500'
                              : 'bg-primary'
                        })(),
                      )}
                      style={{
                        width: `${
                          selectedTeam
                            ? Math.min(
                                100,
                                Math.round((teamCapacityUsed(selectedTeam) / TEAM_CAPACITY_MAX) * 100),
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Fake seat capacity — {TEAM_CAPACITY_MAX} members max per team.
                  </p>
                </section>

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
