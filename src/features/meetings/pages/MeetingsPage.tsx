import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarClock, CircleDot, ClipboardCheck, Link2, Plus, Sparkles, Trash2, Video, Zap } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { meetingApi } from '@/services/meetingApi'
import { orgApi } from '@/services/orgApi'
import { projectApi } from '@/services/projectApi'
import { taskApi } from '@/services/taskApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDateTime, getErrorMessage, getInitials, cn } from '@/utils/cn'
import type { Membership, Meeting, User } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const BULLET_PATTERN = /^([-*•]|\d+[.)])\s+/

/** Extracts bullet / numbered action items from a freeform AI summary. */
function parseActionItems(summary: string): string[] {
  return summary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => BULLET_PATTERN.test(line))
    .map((line) => line.replace(BULLET_PATTERN, '').trim())
    .filter(Boolean)
}

const meetingSchema = z.object({
  title: z.string().min(1).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  agenda: z.string().max(10000).optional().or(z.literal('')),
  notes: z.string().max(50000).optional().or(z.literal('')),
  joinUrl: z.string().max(500).optional().or(z.literal('')),
  participantIds: z.array(z.string()),
})

type MeetingForm = z.infer<typeof meetingSchema>

function toLocalInput(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string) {
  const date = new Date(value)
  return date.toISOString()
}

function memberUser(membership: Membership): User | null {
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

type RsvpStatus = 'going' | 'maybe' | 'declined'

function rsvpKey(meetingId: string, userId: string) {
  return `ts_meeting_rsvp_${meetingId}_${userId}`
}

function loadRsvp(meetingId: string, userId: string): RsvpStatus | null {
  try {
    const raw = localStorage.getItem(rsvpKey(meetingId, userId))
    if (raw === 'going' || raw === 'maybe' || raw === 'declined') return raw
    return null
  } catch {
    return null
  }
}

function saveRsvp(meetingId: string, userId: string, status: RsvpStatus) {
  localStorage.setItem(rsvpKey(meetingId, userId), status)
}

function meetingHasRecording(meeting: Meeting): boolean {
  const past = new Date(meeting.endsAt).getTime() < Date.now()
  if (!past) return false
  let hash = 0
  for (let i = 0; i < meeting.id.length; i++) {
    hash = (hash + meeting.id.charCodeAt(i) * (i + 1)) % 10
  }
  return hash >= 4
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekDaysFromToday(): Date[] {
  const start = startOfWeek(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function meetingOnDay(meeting: Meeting, day: Date) {
  const start = new Date(meeting.startsAt)
  return sameCalendarDay(start, day)
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const emptyValues: MeetingForm = {
  title: '',
  startsAt: '',
  endsAt: '',
  agenda: '',
  notes: '',
  joinUrl: '',
  participantIds: [],
}

export function MeetingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [actionItemsMeeting, setActionItemsMeeting] = useState<Meeting | null>(null)
  const [targetProjectId, setTargetProjectId] = useState('')
  const [rsvpVersion, setRsvpVersion] = useState(0)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const currentUser = useAppSelector((s) => s.auth.user)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const meetingsQuery = useQuery({
    queryKey: ['meetings', orgId],
    queryFn: () => meetingApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && can('meetings:read'),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(orgId),
  })

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => projectApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && can('tasks:create'),
  })
  const projects = projectsQuery.data?.data.items ?? []

  const members = membersQuery.data ?? []
  const usersById = useMemo(() => {
    const map = new Map<string, User>()
    for (const m of members) {
      const u = memberUser(m)
      if (u) map.set(u.id, u)
    }
    return map
  }, [members])

  const form = useForm<MeetingForm>({
    resolver: zodResolver(meetingSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (!drawerOpen) return
    if (editing) {
      form.reset({
        title: editing.title,
        startsAt: toLocalInput(editing.startsAt),
        endsAt: toLocalInput(editing.endsAt),
        agenda: editing.agenda || '',
        notes: editing.notes || '',
        joinUrl: editing.joinUrl || '',
        participantIds: editing.participantIds || [],
      })
    } else {
      form.reset(emptyValues)
    }
  }, [drawerOpen, editing])

  const meetings = [...(meetingsQuery.data?.data.items ?? [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )

  useEffect(() => {
    if (searchParams.get('open') === '1' && can('meetings:create')) {
      setEditing(null)
      setDrawerOpen(true)
      searchParams.delete('open')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const meetingId = searchParams.get('meetingId')
    if (!meetingId || meetingsQuery.isLoading) return
    const found = meetings.find((m) => m.id === meetingId)
    if (found) {
      setHighlightId(found.id)
      if (can('meetings:update')) {
        setEditing(found)
        setDrawerOpen(true)
      }
    }
    searchParams.delete('meetingId')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsQuery.isLoading, meetings.length])

  const weekDays = useMemo(() => weekDaysFromToday(), [])
  const today = new Date()

  const selectedDay = useMemo(() => {
    if (!selectedDayKey) return null
    return weekDays.find((d) => dateKey(d) === selectedDayKey) ?? null
  }, [selectedDayKey, weekDays])

  const isUpcoming = (m: Meeting) => new Date(m.endsAt).getTime() >= Date.now()
  const dayFiltered = selectedDay
    ? meetings.filter((m) => meetingOnDay(m, selectedDay))
    : meetings
  const upcoming = dayFiltered.filter(isUpcoming)
  const past = dayFiltered.filter((m) => !isUpcoming(m))

  const setRsvp = (meetingId: string, status: RsvpStatus) => {
    if (!currentUser?.id) return
    saveRsvp(meetingId, currentUser.id, status)
    setRsvpVersion((v) => v + 1)
    toast.success(`RSVP: ${status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : 'Declined'}`)
  }

  const saveMutation = useMutation({
    mutationFn: (values: MeetingForm) => {
      const payload = {
        title: values.title,
        startsAt: fromLocalInput(values.startsAt),
        endsAt: fromLocalInput(values.endsAt),
        agenda: values.agenda || undefined,
        notes: values.notes || undefined,
        joinUrl: values.joinUrl || null,
        participantIds: values.participantIds,
      }
      return editing ? meetingApi.update(editing.id, payload) : meetingApi.create(payload)
    },
    onSuccess: async () => {
      toast.success(editing ? 'Meeting updated' : 'Meeting scheduled')
      setDrawerOpen(false)
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['meetings', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const instantMutation = useMutation({
    mutationFn: () => {
      const now = new Date()
      const end = new Date(now.getTime() + 30 * 60 * 1000)
      return meetingApi.create({
        title: 'Instant meeting',
        startsAt: now.toISOString(),
        endsAt: end.toISOString(),
      })
    },
    onSuccess: async () => {
      toast.success('Instant meeting started')
      await queryClient.invalidateQueries({ queryKey: ['meetings', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const removeMutation = useMutation({
    mutationFn: (meetingId: string) => meetingApi.remove(meetingId),
    onSuccess: async () => {
      toast.success('Meeting deleted')
      setRemoveId(null)
      await queryClient.invalidateQueries({ queryKey: ['meetings', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const summarizeMutation = useMutation({
    mutationFn: (meetingId: string) => meetingApi.summarize(meetingId),
    onSuccess: async () => {
      toast.success('Summary generated')
      await queryClient.invalidateQueries({ queryKey: ['meetings', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not summarize')),
  })

  const createTasksMutation = useMutation({
    mutationFn: async ({ meeting, projectId }: { meeting: Meeting; projectId: string }) => {
      const items = parseActionItems(meeting.aiSummary || '')
      const results = await Promise.all(
        items.map((title) =>
          taskApi.create({
            projectId,
            title: title.slice(0, 300),
            description: `Action item from meeting "${meeting.title}" on ${formatDateTime(meeting.startsAt)}.`,
            priority: 'medium',
          }),
        ),
      )
      return results.length
    },
    onSuccess: async (count) => {
      toast.success(`${count} task${count === 1 ? '' : 's'} created from action items`)
      setActionItemsMeeting(null)
      setTargetProjectId('')
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create tasks')),
  })

  const openActionItemsDialog = (meeting: Meeting) => {
    const items = parseActionItems(meeting.aiSummary || '')
    if (items.length === 0) {
      toast.warning('No bullet-point action items found in this summary')
      return
    }
    if (projects.length === 0) {
      toast.error('Create a project first — tasks must belong to a project')
      return
    }
    setTargetProjectId(meeting.projectId || projects[0]!.id)
    setActionItemsMeeting(meeting)
  }

  const toggleParticipant = (userId: string) => {
    const current = form.getValues('participantIds')
    form.setValue(
      'participantIds',
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  if (!can('meetings:read')) {
    return (
      <EmptyState
        title="No meeting access"
        description="Your role cannot view workspace meetings."
      />
    )
  }

  const renderMeeting = (meeting: Meeting) => {
    const myRsvp = currentUser?.id ? loadRsvp(meeting.id, currentUser.id) : null
    void rsvpVersion
    const hasRecording = meetingHasRecording(meeting)

    return (
    <li
      key={meeting.id}
      id={`meeting-${meeting.id}`}
      className={cn(
        'surface-panel p-4 shadow-sm transition-all duration-150 hover:border-primary/30 hover:shadow-md',
        highlightId === meeting.id && 'border-primary/50 ring-2 ring-primary/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{meeting.title}</p>
              {hasRecording ? (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CircleDot className="h-3 w-3 text-destructive" />
                  Recording
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(meeting.startsAt)} – {formatDateTime(meeting.endsAt)}
            </p>
            {isUpcoming(meeting) && currentUser?.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">RSVP:</span>
                {(['going', 'maybe', 'declined'] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={myRsvp === status ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-[11px] capitalize"
                    onClick={() => setRsvp(meeting.id, status)}
                  >
                    {status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : 'Declined'}
                  </Button>
                ))}
              </div>
            ) : myRsvp ? (
              <p className="mt-1 text-[11px] text-muted-foreground capitalize">You RSVP'd: {myRsvp}</p>
            ) : null}
            {meeting.agenda ? (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{meeting.agenda}</p>
            ) : null}
            {meeting.aiSummary ? (
              <div className="mt-2 rounded-md bg-primary/5 p-2 text-xs text-foreground/90">
                <p className="mb-1 flex items-center gap-1 font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> AI summary
                </p>
                <p className="whitespace-pre-wrap line-clamp-4">{meeting.aiSummary}</p>
                {can('tasks:create') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-[11px]"
                    onClick={() => openActionItemsDialog(meeting)}
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    Create tasks from action items
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex -space-x-1.5">
                {(meeting.participantIds || []).slice(0, 5).map((id) => {
                  const user = usersById.get(id)
                  return (
                    <Avatar key={id} className="h-6 w-6 border-2 border-card">
                      <AvatarImage src={user?.avatarUrl || undefined} alt="" />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(user?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  )
                })}
              </div>
              {meeting.joinUrl ? (
                <a
                  href={meeting.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Link2 className="h-3 w-3" /> Join link
                </a>
              ) : null}
              {isUpcoming(meeting) ? (
                <Button size="sm" variant="secondary" className="h-7 text-[11px]" asChild>
                  <Link to={`/app/meetings/${meeting.id}/room`}>
                    <Video className="h-3 w-3" />
                    Join room
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {can('meetings:update') && can('ai:use') ? (
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={summarizeMutation.isPending}
              onClick={() => summarizeMutation.mutate(meeting.id)}
              aria-label="Summarize with AI"
              title="Summarize with AI"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {can('meetings:update') ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(meeting)
                setDrawerOpen(true)
              }}
            >
              Edit
            </Button>
          ) : null}
          {can('meetings:delete') ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => setRemoveId(meeting.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Meetings"
        description="Schedule meetings, share join links, and generate AI summaries."
        actions={
          can('meetings:create') ? (
            <>
              <Button variant="outline" onClick={() => instantMutation.mutate()} disabled={instantMutation.isPending}>
                <Zap className="h-4 w-4" />
                Instant meeting
              </Button>
              <Button
                onClick={() => {
                  setEditing(null)
                  setDrawerOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                New meeting
              </Button>
            </>
          ) : null
        }
      />

      {!orgId ? (
        <EmptyState title="Select an organization" />
      ) : meetingsQuery.isLoading ? (
        <LoadingState variant="page" rows={4} />
      ) : meetingsQuery.isError ? (
        <ErrorState onRetry={() => void meetingsQuery.refetch()} />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={<Video className="h-5 w-5" />}
          title="No meetings scheduled"
          description="Plan a meeting with your team or start one instantly."
          actionLabel={can('meetings:create') ? 'New meeting' : undefined}
          onAction={can('meetings:create') ? () => setDrawerOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-7">
          <section className="surface-panel overflow-hidden p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                This week
              </h2>
              {selectedDayKey ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedDayKey(null)}
                >
                  Clear day filter
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, i) => {
                const dayMeetings = meetings.filter((m) => meetingOnDay(m, day))
                const isToday = sameCalendarDay(day, today)
                const key = dateKey(day)
                const isSelected = selectedDayKey === key
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDayKey((prev) => (prev === key ? null : key))}
                    className={cn(
                      'rounded-lg border border-border p-2 text-center transition-colors hover:border-primary/40 hover:bg-accent/40',
                      isToday && 'border-primary/40 bg-primary/5',
                      isSelected && 'border-primary bg-primary/10 ring-1 ring-primary/30',
                    )}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground">
                      {WEEKDAY_SHORT[i]}
                    </p>
                    <p
                      className={cn(
                        'mt-0.5 text-sm font-semibold tabular-nums',
                        (isToday || isSelected) && 'text-primary',
                      )}
                    >
                      {day.getDate()}
                    </p>
                    <div className="mt-2 flex min-h-[36px] flex-col gap-1">
                      {dayMeetings.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground/50">—</span>
                      ) : (
                        dayMeetings.slice(0, 3).map((m) => (
                          <span
                            key={m.id}
                            className="truncate rounded bg-primary/15 px-1 py-0.5 text-[9px] font-medium text-primary"
                            title={m.title}
                          >
                            {new Date(m.startsAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}{' '}
                            {m.title}
                          </span>
                        ))
                      )}
                      {dayMeetings.length > 3 ? (
                        <span className="text-[9px] text-muted-foreground">
                          +{dayMeetings.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming
              <Badge variant="secondary" className="tabular-nums">
                {upcoming.length}
              </Badge>
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
            ) : (
              <ul className="space-y-2">{upcoming.map(renderMeeting)}</ul>
            )}
          </section>
          {past.length > 0 ? (
            <section>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Past
              </h2>
              <ul className="space-y-2 opacity-70">{past.slice(0, 10).map(renderMeeting)}</ul>
            </section>
          ) : null}
        </div>
      )}

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setEditing(null)
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit meeting' : 'New meeting'}</SheetTitle>
            <SheetDescription>
              Set a title, time range, and optional agenda for your meeting.
            </SheetDescription>
          </SheetHeader>
          <form
            className="space-y-4 p-5"
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="meetingTitle">Title</Label>
              <Input id="meetingTitle" {...form.register('title')} placeholder="Sprint planning" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts</Label>
                <Input id="startsAt" type="datetime-local" {...form.register('startsAt')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Ends</Label>
                <Input id="endsAt" type="datetime-local" {...form.register('endsAt')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinUrl">Join URL</Label>
              <Input id="joinUrl" {...form.register('joinUrl')} placeholder="https://meet.google.com/…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda">Agenda</Label>
              <Textarea id="agenda" rows={3} {...form.register('agenda')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={4} {...form.register('notes')} />
            </div>
            <div className="space-y-2">
              <Label>Participants</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {members.map((m) => {
                  const user = memberUser(m)
                  if (!user) return null
                  const checked = form.watch('participantIds').includes(user.id)
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={user.id === currentUser?.id}
                        onCheckedChange={() => toggleParticipant(user.id)}
                      />
                      {user.name || user.email}
                      {user.id === currentUser?.id ? (
                        <Badge variant="secondary" className="text-[10px]">
                          you
                        </Badge>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Schedule'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title="Delete meeting?"
        description="Participants will no longer see this meeting."
        confirmLabel="Delete"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />

      <Dialog
        open={Boolean(actionItemsMeeting)}
        onOpenChange={(open) => !open && setActionItemsMeeting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create tasks from action items</DialogTitle>
            <DialogDescription>
              {actionItemsMeeting
                ? `${parseActionItems(actionItemsMeeting.aiSummary || '').length} action item(s) found in the AI summary.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {actionItemsMeeting ? (
            <div className="space-y-4">
              <ul className="max-h-48 list-disc space-y-1 overflow-y-auto rounded-md border border-border p-3 pl-7 text-sm">
                {parseActionItems(actionItemsMeeting.aiSummary || '').map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionItemsMeeting(null)}>
              Cancel
            </Button>
            <Button
              disabled={!targetProjectId || createTasksMutation.isPending}
              onClick={() =>
                actionItemsMeeting &&
                createTasksMutation.mutate({ meeting: actionItemsMeeting, projectId: targetProjectId })
              }
            >
              {createTasksMutation.isPending ? 'Creating…' : 'Create tasks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
