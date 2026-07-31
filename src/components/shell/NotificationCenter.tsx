import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, isThisWeek, isToday, isYesterday } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { notificationApi } from '@/services/notificationApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setNotificationsOpen } from '@/store/uiSlice'
import { cn, formatDate } from '@/utils/cn'
import type { NotificationItem } from '@/types'

function dayGroupLabel(dateStr?: string) {
  if (!dateStr) return 'Earlier'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Earlier'
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'This week'
  return formatDate(date)
}

function groupByDay(items: NotificationItem[]) {
  const groups = new Map<string, NotificationItem[]>()
  for (const item of items) {
    const label = dayGroupLabel(item.createdAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(item)
  }
  return Array.from(groups.entries())
}

export function NotificationCenter() {
  const open = useAppSelector((s) => s.ui.notificationsOpen)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', orgId],
    queryFn: () =>
      notificationApi.list({
        limit: 40,
        organizationId: orgId,
      }),
    enabled: Boolean(orgId && open),
  })

  const items = data?.data.items ?? []
  const unread = items.filter((n) => !n.readAt)
  const grouped = useMemo(() => groupByDay(items), [items])

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <Sheet open={open} onOpenChange={(v) => dispatch(setNotificationsOpen(v))}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <SheetTitle>Inbox</SheetTitle>
              <SheetDescription>
                {unread.length
                  ? `${unread.length} unread notification${unread.length === 1 ? '' : 's'}`
                  : 'You’re caught up'}
              </SheetDescription>
            </div>
            {unread.length ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              No notifications yet. Mentions, assignments, and invites will land here.
            </div>
          ) : (
            <div>
              {grouped.map(([label, groupItems]) => (
                <div key={label}>
                  <p className="sticky top-0 z-10 bg-card px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <ul className="divide-y divide-border">
                    {groupItems.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full flex-col gap-1 px-5 py-3.5 text-left transition hover:bg-accent/60',
                            !item.readAt && 'bg-accent/30',
                          )}
                          onClick={() => {
                            if (!item.readAt) markRead.mutate(item.id)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{item.title}</p>
                            {!item.readAt ? (
                              <Badge variant="secondary" className="text-[10px]">
                                New
                              </Badge>
                            ) : null}
                          </div>
                          {item.body ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                          ) : null}
                          <p className="text-[11px] text-muted-foreground">
                            {item.createdAt
                              ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                              : null}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
