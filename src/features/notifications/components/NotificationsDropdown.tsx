import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notificationApi } from '@/services/notificationApi'
import { useAppSelector } from '@/store'
import { cn } from '@/utils/cn'

export function NotificationsDropdown() {
  const queryClient = useQueryClient()
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)

  const { data } = useQuery({
    queryKey: ['notifications', orgId],
    queryFn: () =>
      notificationApi.list({
        limit: 20,
        organizationId: orgId,
      }),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  })

  const items = data?.data.items ?? []
  const unread = items.filter((n) => !n.readAt).length

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className={cn(
                'flex flex-col items-start gap-1 py-3',
                !item.readAt && 'bg-accent/40',
              )}
              onClick={() => {
                if (!item.readAt) markRead.mutate(item.id)
              }}
            >
              <span className="text-sm font-medium">{item.title}</span>
              {item.body ? (
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {item.body}
                </span>
              ) : null}
              {item.createdAt ? (
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
