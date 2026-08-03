import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bookmark,
  Globe2,
  Hash,
  Lock,
  MessageSquare,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { channelApi } from '@/services/channelApi'
import { orgApi } from '@/services/orgApi'
import { emitTypingStart, emitTypingStop, getSocket } from '@/services/socket'
import { useChannelRealtime, messagesQueryKey } from '@/features/chat/hooks/useChannelRealtime'
import { MessageComposer } from '@/features/chat/components/MessageComposer'
import { MessageRow } from '@/features/chat/components/MessageRow'
import { PinnedMessagesStrip } from '@/features/chat/components/PinnedMessagesStrip'
import { BookmarksPanel } from '@/features/chat/components/BookmarksPanel'
import type { BookmarkEntry, PinnedEntry } from '@/features/chat/utils/chatStorage'
import { PresenceDot } from '@/components/shared/PresenceDot'
import { authApi } from '@/services/authApi'
import { setUser } from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { usePresence } from '@/hooks/usePresence'
import { getErrorMessage, getInitials, cn } from '@/utils/cn'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/types'
import type { Channel, Membership, Message, MessageAttachment, MessageBookmarkEntry, MessagePinEntry, User } from '@/types'

function toPinnedEntry(pin: MessagePinEntry): PinnedEntry {
  return {
    messageId: pin.messageId,
    pinnedAt: pin.pinnedAt || new Date().toISOString(),
    body: pin.body,
    authorName: pin.authorName,
    createdAt: pin.createdAt,
  }
}

function toBookmarkEntry(
  bookmark: MessageBookmarkEntry,
  channelLabel?: string,
): BookmarkEntry {
  return {
    id: bookmark.id,
    messageId: bookmark.messageId,
    channelId: bookmark.channelId,
    channelLabel: bookmark.channelLabel || channelLabel || bookmark.channelId,
    body: bookmark.body,
    authorName: bookmark.authorName,
    messageCreatedAt: bookmark.messageCreatedAt,
    savedAt: bookmark.savedAt || new Date().toISOString(),
  }
}

const channelSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().or(z.literal('')),
  isPrivate: z.boolean(),
})

type ChannelForm = z.infer<typeof channelSchema>

function memberUser(membership: Membership): User | null {
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

function authorOf(message: Message): User | null {
  return typeof message.authorId === 'object' ? (message.authorId as User) : null
}

const EMPTY_CHANNELS: Channel[] = []

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [dmDialogOpen, setDmDialogOpen] = useState(false)
  const [addPeopleOpen, setAddPeopleOpen] = useState(false)
  const [inviteMemberIds, setInviteMemberIds] = useState<string[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const currentUser = useAppSelector((s) => s.auth.user)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const { onlineMap } = usePresence()
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const channelsQuery = useQuery({
    queryKey: ['channels', orgId],
    queryFn: () => channelApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && can('channels:read'),
  })

  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => orgApi.listMembers(orgId!),
    enabled: Boolean(orgId) && can('channels:read'),
  })

  const channels = channelsQuery.data?.data.items ?? EMPTY_CHANNELS
  const members = membersQuery.data ?? []
  const channelIdFromUrl = searchParams.get('channelId')
  const messageIdFromUrl = searchParams.get('messageId')

  const unreadSummaryQuery = useQuery({
    queryKey: ['channels', 'unread-summary', orgId],
    queryFn: () => channelApi.unreadSummary(),
    enabled: Boolean(orgId) && can('channels:read'),
    refetchInterval: 60_000,
  })

  const bookmarksQuery = useQuery({
    queryKey: ['channels', 'bookmarks', orgId],
    queryFn: () => channelApi.listBookmarks(),
    enabled: Boolean(orgId) && can('channels:read'),
  })

  useEffect(() => {
    const open = searchParams.get('open')
    if (!open) return
    if (open === '1' || open === 'channel') {
      if (can('channels:create')) setChannelDialogOpen(true)
    } else if (open === 'dm') {
      setDmDialogOpen(true)
    }
    searchParams.delete('open')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // URL is the single source of truth — avoids setState ↔ searchParams loops
  // that were refetching messages on every navigation tick.
  const selectedId = useMemo(() => {
    if (channelIdFromUrl && channels.some((c) => c.id === channelIdFromUrl)) {
      return channelIdFromUrl
    }
    return channels[0]?.id ?? null
  }, [channelIdFromUrl, channels])

  const pinsQuery = useQuery({
    queryKey: ['channels', 'pins', orgId, selectedId],
    queryFn: () => channelApi.listPins(selectedId!),
    enabled: Boolean(orgId && selectedId),
  })

  const selectChannel = useCallback(
    (id: string) => {
      void channelApi.markRead(id).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['channels', 'unread-summary', orgId] })
      })
      setSearchParams(
        (prev) => {
          if (prev.get('channelId') === id) return prev
          const next = new URLSearchParams(prev)
          next.set('channelId', id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, queryClient, orgId],
  )

  useEffect(() => {
    if (!channels.length) return
    if (channelIdFromUrl && channels.some((c) => c.id === channelIdFromUrl)) return
    const fallback = channels[0]?.id
    if (!fallback) return
    setSearchParams(
      (prev) => {
        if (prev.get('channelId') === fallback) return prev
        const next = new URLSearchParams(prev)
        next.set('channelId', fallback)
        return next
      },
      { replace: true },
    )
  }, [channels, channelIdFromUrl, setSearchParams])

  const usersById = useMemo(() => {
    const map = new Map<string, User>()
    for (const m of members) {
      const u = memberUser(m)
      if (u) map.set(u.id, u)
    }
    return map
  }, [members])

  const mentionUsers = useMemo(() => {
    const selected = channels.find((c) => c.id === selectedId)
    const ids = selected?.memberIds?.length ? new Set(selected.memberIds.map(String)) : null
    return Array.from(usersById.values())
      .filter((u) => !ids || ids.has(u.id) || selected?.type === 'public')
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
      }))
  }, [usersById, channels, selectedId])

  const dmPeer = (channel: Channel): User | null => {
    const otherId = (channel.memberIds || []).find((id) => id !== currentUser?.id)
    return otherId ? usersById.get(otherId) || null : null
  }

  const channelTitle = (channel: Channel) => {
    if (channel.type === 'direct') {
      const peer = dmPeer(channel)
      return peer?.name || peer?.email || 'Direct message'
    }
    return channel.name
  }

  const matchesSearch = (channel: Channel) =>
    !search.trim() || channelTitle(channel).toLowerCase().includes(search.trim().toLowerCase())

  const publicChannels = channels.filter((c) => c.type === 'public' && matchesSearch(c))
  const privateChannels = channels.filter((c) => c.type === 'private' && matchesSearch(c))
  const dmChannels = channels.filter((c) => c.type === 'direct' && matchesSearch(c))
  const noSearchResults =
    search.trim().length > 0 &&
    publicChannels.length === 0 &&
    privateChannels.length === 0 &&
    dmChannels.length === 0

  useEffect(() => {
    setActiveThreadId(null)
    setMessageSearch('')
  }, [selectedId])

  const pinnedEntries = useMemo(
    () => (pinsQuery.data ?? []).map(toPinnedEntry),
    [pinsQuery.data],
  )

  const pinnedIds = useMemo(
    () => new Set(pinnedEntries.map((p) => p.messageId)),
    [pinnedEntries],
  )

  const bookmarks = useMemo(() => {
    const labelFor = (channelId: string) => {
      const channel = channels.find((c) => c.id === channelId)
      return channel ? channelTitle(channel) : channelId
    }
    return (bookmarksQuery.data ?? []).map((b) => toBookmarkEntry(b, labelFor(b.channelId)))
  }, [bookmarksQuery.data, channels, members, currentUser?.id])

  const bookmarkedKeys = useMemo(
    () => new Set(bookmarks.map((b) => `${b.channelId}:${b.messageId}`)),
    [bookmarks],
  )

  const pinMutation = useMutation({
    mutationFn: (messageId: string) => channelApi.pinMessage(selectedId!, messageId),
    onSuccess: async () => {
      toast.success('Message pinned')
      await queryClient.invalidateQueries({ queryKey: ['channels', 'pins', orgId, selectedId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const unpinMutation = useMutation({
    mutationFn: (messageId: string) => channelApi.unpinMessage(selectedId!, messageId),
    onSuccess: async () => {
      toast.success('Message unpinned')
      await queryClient.invalidateQueries({ queryKey: ['channels', 'pins', orgId, selectedId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const addBookmarkMutation = useMutation({
    mutationFn: ({ channelId, messageId }: { channelId: string; messageId: string }) =>
      channelApi.addBookmark(channelId, messageId),
    onSuccess: async () => {
      toast.success('Message saved to bookmarks')
      await queryClient.invalidateQueries({ queryKey: ['channels', 'bookmarks', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const removeBookmarkMutation = useMutation({
    mutationFn: (bookmarkId: string) => channelApi.removeBookmark(bookmarkId),
    onSuccess: async () => {
      toast.success('Bookmark removed')
      await queryClient.invalidateQueries({ queryKey: ['channels', 'bookmarks', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const selected = channels.find((c) => c.id === selectedId) || null
  const mutedIds = currentUser?.notificationPreferences?.mutedChannelIds || []
  const isMuted = Boolean(selectedId && mutedIds.includes(selectedId))
  const { typingUsers } = useChannelRealtime(selectedId, activeThreadId)

  const toggleMute = async () => {
    if (!selectedId || !currentUser) return
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(currentUser.notificationPreferences || {}),
    }
    const mutedChannelIds = isMuted
      ? prefs.mutedChannelIds.filter((id) => id !== selectedId)
      : [...(prefs.mutedChannelIds || []), selectedId]
    try {
      const updated = await authApi.updateMe({
        notificationPreferences: { ...prefs, mutedChannelIds },
      })
      dispatch(setUser(updated))
      authApi.setLocalNotificationPreferences({ ...prefs, mutedChannelIds })
      toast.success(isMuted ? 'Channel unmuted' : 'Channel muted')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey(orgId, selectedId || '', null),
    queryFn: () => channelApi.listMessages(selectedId!, { limit: 50 }),
    enabled: Boolean(orgId && selectedId),
  })

  const threadQuery = useQuery({
    queryKey: messagesQueryKey(orgId, selectedId || '', activeThreadId),
    queryFn: () => channelApi.listMessages(selectedId!, { limit: 50, parentMessageId: activeThreadId }),
    enabled: Boolean(orgId && selectedId && activeThreadId),
  })

  const form = useForm<ChannelForm>({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: '', description: '', isPrivate: false },
  })

  const openChannelDialog = (isPrivate: boolean) => {
    form.reset({ name: '', description: '', isPrivate })
    setInviteMemberIds([])
    setChannelDialogOpen(true)
  }

  const createChannel = useMutation({
    mutationFn: (values: ChannelForm) =>
      channelApi.create({
        name: values.name,
        description: values.description || undefined,
        type: values.isPrivate ? 'private' : 'public',
        memberIds: values.isPrivate ? inviteMemberIds : undefined,
      }),
    onSuccess: async (result) => {
      toast.success(
        result.channel.type === 'public'
          ? 'Public channel created — everyone in the company can chat here'
          : 'Private channel created — only invited members can chat',
      )
      setChannelDialogOpen(false)
      setInviteMemberIds([])
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
      selectChannel(result.channel.id)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const makePublic = useMutation({
    mutationFn: () => channelApi.update(selectedId!, { type: 'public' }),
    onSuccess: async () => {
      toast.success('Channel is now public — all org members can chat')
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const addPeople = useMutation({
    mutationFn: (memberIds: string[]) => channelApi.addMembers(selectedId!, memberIds),
    onSuccess: async () => {
      toast.success('Members added to channel')
      setAddPeopleOpen(false)
      setInviteMemberIds([])
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const createDm = useMutation({
    mutationFn: (userId: string) => channelApi.createDm(userId),
    onSuccess: async (result) => {
      setDmDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['channels'] })
      selectChannel(result.channel.id)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const sendMessage = useMutation({
    mutationFn: ({ body, attachments }: { body: string; attachments: MessageAttachment[] }) =>
      channelApi.sendMessage(selectedId!, body, null, attachments.length ? attachments : undefined),
    onSuccess: async () => {
      emitTypingStop(selectedId!)
      await queryClient.invalidateQueries({ queryKey: messagesQueryKey(orgId, selectedId || '', null) })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const sendReply = useMutation({
    mutationFn: ({ body, attachments }: { body: string; attachments: MessageAttachment[] }) =>
      channelApi.sendMessage(
        selectedId!,
        body,
        activeThreadId,
        attachments.length ? attachments : undefined,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: messagesQueryKey(orgId, selectedId || '', activeThreadId),
      })
      await queryClient.invalidateQueries({ queryKey: messagesQueryKey(orgId, selectedId || '', null) })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const toggleReaction = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      channelApi.toggleReaction(selectedId!, messageId, emoji),
    onMutate: async ({ messageId, emoji }) => {
      if (!orgId || !currentUser?.id || !selectedId) return
      const patch = (parentKey: string | null) => {
        const key = messagesQueryKey(orgId, selectedId, parentKey)
        const prev = queryClient.getQueryData<{ data: { items: Message[] } }>(key)
        if (!prev) return
        queryClient.setQueryData(key, {
          ...prev,
          data: {
            ...prev.data,
            items: prev.data.items.map((m) => {
              if (m.id !== messageId) return m
              const reactions = [...(m.reactions || [])].map((r) => ({
                emoji: r.emoji,
                userIds: [...r.userIds.map(String)],
              }))
              const idx = reactions.findIndex((r) => r.emoji === emoji)
              const uid = currentUser.id
              if (idx === -1) {
                reactions.push({ emoji, userIds: [uid] })
              } else {
                const users = reactions[idx]!.userIds
                reactions[idx]!.userIds = users.includes(uid)
                  ? users.filter((id) => id !== uid)
                  : [...users, uid]
                if (!reactions[idx]!.userIds.length) reactions.splice(idx, 1)
              }
              return { ...m, reactions }
            }),
          },
        })
      }
      patch(null)
      if (activeThreadId) patch(activeThreadId)
    },
    onSuccess: (result) => {
      const message = result.message
      if (!orgId || !selectedId || !message) return
      const apply = (parentKey: string | null) => {
        const key = messagesQueryKey(orgId, selectedId, parentKey)
        queryClient.setQueryData<{ data: { items: Message[] } }>(key, (old) => {
          if (!old) return old
          return {
            ...old,
            data: {
              ...old.data,
              items: old.data.items.map((m) =>
                m.id === message.id
                  ? { ...m, ...message, replyCount: message.replyCount ?? m.replyCount }
                  : m,
              ),
            },
          }
        })
      }
      apply(null)
      if (message.parentMessageId) apply(message.parentMessageId)
      if (activeThreadId) apply(activeThreadId)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      void queryClient.invalidateQueries({ queryKey: ['messages', orgId, selectedId] })
    },
  })

  const handleTyping = () => {
    if (!selectedId) return
    emitTypingStart(selectedId)
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current)
    typingStopTimer.current = setTimeout(() => emitTypingStop(selectedId), 2500)
  }

  const rawMessages = messagesQuery.data?.data.items
  const messages = useMemo(
    () => [...(rawMessages ?? [])].reverse(),
    [rawMessages],
  )
  const messageQuery = messageSearch.trim().toLowerCase()
  const displayedMessages = messageQuery
    ? messages.filter((m) => (m.body || '').toLowerCase().includes(messageQuery))
    : messages
  const rawThread = threadQuery.data?.data.items
  const threadMessages = useMemo(
    () => [...(rawThread ?? [])].reverse(),
    [rawThread],
  )
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  useEffect(() => {
    if (!selectedId || messagesQuery.isLoading || !rawMessages?.length) return
    const latest = rawMessages.reduce((max, m) => {
      if (!m.createdAt) return max
      const t = new Date(m.createdAt).getTime()
      return t > max ? t : max
    }, 0)
    void channelApi
      .markRead(selectedId, latest ? new Date(latest).toISOString() : undefined)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['channels', 'unread-summary', orgId] })
      })
  }, [selectedId, rawMessages, messagesQuery.isLoading, orgId, queryClient])

  useEffect(() => {
    if (!orgId) return
    const socket = getSocket()
    if (!socket) return

    const onNewMessage = (message: Message) => {
      const channelId = String(message.channelId)
      if (channelId === selectedId) return
      void queryClient.invalidateQueries({ queryKey: ['channels', 'unread-summary', orgId] })
    }

    socket.on('message:new', onNewMessage)
    return () => {
      socket.off('message:new', onNewMessage)
    }
  }, [orgId, selectedId, queryClient])

  const unreadByChannel = useMemo(() => {
    const counts = unreadSummaryQuery.data?.counts ?? {}
    const map = new Map<string, number>()
    for (const channel of channels) {
      if (channel.id === selectedId) continue
      const count = counts[channel.id]
      if (count && count > 0) map.set(channel.id, count)
    }
    return map
  }, [channels, selectedId, unreadSummaryQuery.data])

  const handlePin = (message: Message) => {
    if (!selectedId) return
    pinMutation.mutate(message.id)
  }

  const handleUnpin = (messageId: string) => {
    if (!selectedId) return
    unpinMutation.mutate(messageId)
  }

  const handleBookmark = (message: Message) => {
    if (!selected) return
    addBookmarkMutation.mutate({ channelId: selected.id, messageId: message.id })
  }

  const handleRemoveBookmark = (message: Message) => {
    const entry = bookmarks.find(
      (b) => b.messageId === message.id && b.channelId === message.channelId,
    )
    if (!entry) return
    removeBookmarkMutation.mutate(entry.id)
  }

  const handleRemoveBookmarkById = (id: string) => {
    removeBookmarkMutation.mutate(id)
  }

  const jumpToMessage = (messageId: string) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (!messageIdFromUrl || !selectedId) return
    const t = window.setTimeout(() => {
      jumpToMessage(messageIdFromUrl)
      searchParams.delete('messageId')
      setSearchParams(searchParams, { replace: true })
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdFromUrl, selectedId, messages.length])

  const goToBookmark = (channelId: string, messageId: string) => {
    selectChannel(channelId)
    window.setTimeout(() => jumpToMessage(messageId), 400)
  }
  const threadParent = activeThreadId
    ? messages.find((m) => m.id === activeThreadId) || null
    : null

  const typingNames = typingUsers
    .map((id) => usersById.get(id)?.name || 'Someone')
    .filter(Boolean)

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden">
      {!can('channels:read') ? (
        <EmptyState
          title="No chat access"
          description="Your role cannot view channels in this workspace."
        />
      ) : !orgId ? (
        <EmptyState title="Select an organization" />
      ) : channelsQuery.isLoading ? (
        <LoadingState variant="chat" />
      ) : channelsQuery.isError ? (
        <ErrorState onRetry={() => void channelsQuery.refetch()} />
      ) : (
        <div
          className={cn(
            'ts-chat-shell grid min-h-0 flex-1',
            activeThreadId
              ? 'lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,320px)]'
              : 'lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]',
          )}
        >
          <aside className="ts-module-rail-flat flex min-h-0 min-w-0 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r">
            <div className="shrink-0 space-y-2 border-b border-border/70 p-2">
              <div className="flex items-center gap-1">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels"
                    className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground transition focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="New DM"
                  onClick={() => setDmDialogOpen(true)}
                >
                  <Users className="h-4 w-4" />
                </Button>
                {can('channels:create') ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="New channel"
                    onClick={() => openChannelDialog(false)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="ts-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
              {noSearchResults ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No channels match “{search}”.
                </p>
              ) : (
                <>
                  <ChannelSection
                    title="Channels"
                    icon={Hash}
                    channels={publicChannels}
                    selectedId={selectedId}
                    onSelect={selectChannel}
                    labelOf={channelTitle}
                    unreadByChannel={unreadByChannel}
                    onCreate={can('channels:create') ? () => openChannelDialog(false) : undefined}
                  />
                  <ChannelSection
                    title="Private"
                    icon={Lock}
                    channels={privateChannels}
                    selectedId={selectedId}
                    onSelect={selectChannel}
                    labelOf={channelTitle}
                    unreadByChannel={unreadByChannel}
                    onCreate={can('channels:create') ? () => openChannelDialog(true) : undefined}
                  />
                  <ChannelSection
                    title="Direct messages"
                    icon={Users}
                    channels={dmChannels}
                    selectedId={selectedId}
                    onSelect={selectChannel}
                    labelOf={channelTitle}
                    unreadByChannel={unreadByChannel}
                    avatarOf={(channel) => dmPeer(channel)}
                    presenceOf={(channel) => {
                      const peer = dmPeer(channel)
                      return peer ? onlineMap[peer.id]?.status || 'offline' : null
                    }}
                    onCreate={() => setDmDialogOpen(true)}
                  />
                </>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[color:var(--ts-card)]">
            {!selected ? (
              <EmptyState
                className="m-4 border-0 bg-transparent"
                icon={<MessageSquare className="h-5 w-5" />}
                title="No channel selected"
                description="Create a channel or start a DM to begin chatting."
                actionLabel="Create channel"
                onAction={() => openChannelDialog(false)}
              />
            ) : (
              <>
                <div className="flex min-w-0 shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border/70 px-3 py-2.5 sm:px-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {selected.type === 'direct' ? (
                        <div className="relative shrink-0">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={dmPeer(selected)?.avatarUrl || undefined} alt="" />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(dmPeer(selected)?.name || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <PresenceDot
                            status={onlineMap[dmPeer(selected)?.id || '']?.status}
                            className="absolute -bottom-0.5 -right-0.5"
                          />
                        </div>
                      ) : selected.type === 'private' ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <h2 className="truncate text-[15px] font-semibold text-foreground">
                        {channelTitle(selected)}
                      </h2>
                      {selected.type === 'private' ? (
                        <span className="hidden shrink-0 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline-block">
                          {selected.memberIds?.length ?? 0} members
                        </span>
                      ) : selected.type === 'public' ? (
                        <span className="hidden shrink-0 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline-block">
                          Everyone
                        </span>
                      ) : null}
                    </div>
                    {selected.description ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {selected.description}
                      </p>
                    ) : selected.type === 'private' ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Only invited members can see this channel
                      </p>
                    ) : selected.type === 'public' ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Anyone in the organization can post here
                      </p>
                    ) : null}
                  </div>
                  <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                    <div className="relative hidden md:block">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={messageSearch}
                        onChange={(e) => setMessageSearch(e.target.value)}
                        placeholder="Search messages"
                        className="h-8 w-36 rounded-md border border-border bg-background pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground transition focus:outline-none focus:ring-2 focus:ring-ring/30 xl:w-48"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBookmarksOpen(true)}
                      className="relative"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Bookmarks</span>
                      {bookmarks.length > 0 ? (
                        <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          {bookmarks.length > 99 ? '99+' : bookmarks.length}
                        </span>
                      ) : null}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void toggleMute()}>
                      {isMuted ? 'Unmute' : 'Mute'}
                    </Button>
                    {selected.type === 'private' && can('channels:update') ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInviteMemberIds([])
                            setAddPeopleOpen(true)
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Add people</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={makePublic.isPending}
                          onClick={() => makePublic.mutate()}
                        >
                          <Globe2 className="h-3.5 w-3.5" />
                          Make public
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="ts-scrollbar min-h-0 min-w-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2.5 py-4">
                  {messagesQuery.isLoading ? (
                    <LoadingState rows={4} />
                  ) : messagesQuery.isError ? (
                    <ErrorState onRetry={() => void messagesQuery.refetch()} />
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                        {selected.type === 'direct' ? (
                          <Users className="h-5 w-5" />
                        ) : selected.type === 'private' ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <Hash className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="app-title text-sm text-foreground">
                          {selected.type === 'direct'
                            ? `The beginning of your conversation with ${channelTitle(selected)}`
                            : `Welcome to ${channelTitle(selected)}`}
                        </p>
                        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                          {selected.type === 'direct'
                            ? 'Say hello and start collaborating.'
                            : 'Be the first to post a message in this channel.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <PinnedMessagesStrip
                        entries={pinnedEntries}
                        messagesById={messagesById}
                        onUnpin={handleUnpin}
                        onJumpTo={jumpToMessage}
                      />
                      {displayedMessages.length === 0 ? (
                        <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                          No messages match “{messageSearch.trim()}”.
                        </p>
                      ) : (
                        displayedMessages.map((msg) => (
                          <MessageRow
                            key={msg.id}
                            message={msg}
                            author={authorOf(msg)}
                            currentUserId={currentUser?.id}
                            usersById={usersById}
                            onToggleReaction={(emoji) =>
                              toggleReaction.mutate({ messageId: msg.id, emoji })
                            }
                            onOpenThread={() => setActiveThreadId(msg.id)}
                            isPinned={pinnedIds.has(msg.id)}
                            isBookmarked={bookmarkedKeys.has(`${selectedId}:${msg.id}`)}
                            onPin={() => handlePin(msg)}
                            onUnpin={() => handleUnpin(msg.id)}
                            onBookmark={() => handleBookmark(msg)}
                            onRemoveBookmark={() => handleRemoveBookmark(msg)}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>

                {typingNames.length > 0 ? (
                  <p className="shrink-0 px-4 pb-1 text-[11px] italic text-muted-foreground">
                    {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
                  </p>
                ) : null}

                <div className="shrink-0 border-t border-border/60">
                  <MessageComposer
                    placeholder={`Message ${selected.type === 'direct' ? channelTitle(selected) : '#' + selected.name}`}
                    onSend={(body, attachments) => sendMessage.mutate({ body, attachments })}
                    onTyping={() => handleTyping()}
                    sending={sendMessage.isPending}
                    mentionUsers={mentionUsers}
                    currentUserId={currentUser?.id}
                    autoFocus
                  />
                </div>
              </>
            )}
          </section>

          {activeThreadId ? (
            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-border bg-[color:var(--ts-elevated)] lg:border-l lg:border-t-0">
              <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-3 py-2.5">
                <h3 className="text-[13px] font-semibold text-foreground">Thread</h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setActiveThreadId(null)}
                  aria-label="Close thread"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="ts-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
                {threadParent ? (
                  <div className="mb-2 border-b border-border/70 pb-2">
                    <MessageRow
                      message={threadParent}
                      author={authorOf(threadParent)}
                      currentUserId={currentUser?.id}
                      usersById={usersById}
                      onToggleReaction={(emoji) =>
                        toggleReaction.mutate({ messageId: threadParent.id, emoji })
                      }
                      isThreadReply
                    />
                  </div>
                ) : null}
                {threadQuery.isLoading ? (
                  <LoadingState rows={2} />
                ) : threadMessages.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      No replies yet — be the first to respond.
                    </p>
                  </div>
                ) : (
                  threadMessages.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      message={msg}
                      author={authorOf(msg)}
                      currentUserId={currentUser?.id}
                      usersById={usersById}
                      onToggleReaction={(emoji) => toggleReaction.mutate({ messageId: msg.id, emoji })}
                      isThreadReply
                    />
                  ))
                )}
              </div>
              <div className="shrink-0 border-t border-border/60">
                <MessageComposer
                  placeholder="Reply in thread"
                  onSend={(body, attachments) => sendReply.mutate({ body, attachments })}
                  sending={sendReply.isPending}
                  mentionUsers={mentionUsers}
                  currentUserId={currentUser?.id}
                />
              </div>
            </aside>
          ) : null}
        </div>
      )}

      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create channel</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createChannel.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register('name')} placeholder="general" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...form.register('description')} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.watch('isPrivate')}
                onCheckedChange={(checked) => {
                  form.setValue('isPrivate', Boolean(checked))
                  if (!checked) setInviteMemberIds([])
                }}
              />
              Private channel (only invited people can chat)
            </label>
            {form.watch('isPrivate') ? (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                <p className="mb-1 text-xs text-muted-foreground">Invite members now</p>
                {members
                  .filter((m) => memberUser(m) && memberUser(m)!.id !== currentUser?.id)
                  .map((m) => {
                    const user = memberUser(m)!
                    const checked = inviteMemberIds.includes(user.id)
                    return (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(on) => {
                            setInviteMemberIds((prev) =>
                              on ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                            )
                          }}
                        />
                        <span className="truncate">{user.name || user.email}</span>
                      </label>
                    )
                  })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tip: leave unchecked for company-wide channels like #general.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChannelDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createChannel.isPending}>
                {createChannel.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addPeopleOpen} onOpenChange={setAddPeopleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add people to #{selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {members
              .filter((m) => {
                const user = memberUser(m)
                if (!user || user.id === currentUser?.id) return false
                return !(selected?.memberIds || []).includes(user.id)
              })
              .map((m) => {
                const user = memberUser(m)!
                const checked = inviteMemberIds.includes(user.id)
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(on) => {
                        setInviteMemberIds((prev) =>
                          on ? [...prev, user.id] : prev.filter((id) => id !== user.id),
                        )
                      }}
                    />
                    <span className="truncate">{user.name || user.email}</span>
                  </label>
                )
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPeopleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!inviteMemberIds.length || addPeople.isPending}
              loading={addPeople.isPending}
              onClick={() => addPeople.mutate(inviteMemberIds)}
            >
              Add selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dmDialogOpen} onOpenChange={setDmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a direct message</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {members
              .filter((m) => memberUser(m) && memberUser(m)!.id !== currentUser?.id)
              .map((m) => {
                const user = memberUser(m)!
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={createDm.isPending}
                    onClick={() => createDm.mutate(user.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatarUrl || undefined} alt="" />
                      <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user.name || user.email}</span>
                  </button>
                )
              })}
          </div>
        </DialogContent>
      </Dialog>

      <BookmarksPanel
        open={bookmarksOpen}
        onOpenChange={setBookmarksOpen}
        bookmarks={bookmarks}
        onRemove={handleRemoveBookmarkById}
        onGoTo={goToBookmark}
      />
    </div>
  )
}

interface ChannelSectionProps {
  title: string
  icon: typeof Hash
  channels: Channel[]
  selectedId: string | null
  onSelect: (id: string) => void
  labelOf: (channel: Channel) => string
  avatarOf?: (channel: Channel) => User | null
  presenceOf?: (channel: Channel) => 'online' | 'away' | 'offline' | null
  unreadByChannel?: Map<string, number>
  onCreate?: () => void
}

function ChannelSection({
  title,
  icon: Icon,
  channels,
  selectedId,
  onSelect,
  labelOf,
  avatarOf,
  presenceOf,
  unreadByChannel,
  onCreate,
}: ChannelSectionProps) {
  if (channels.length === 0 && !onCreate) return null

  return (
    <div className="pb-1.5">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={`New ${title.toLowerCase()}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {channels.length === 0 ? (
        <p className="px-3 pb-1 text-[11px] text-muted-foreground/70">Nothing here yet</p>
      ) : (
        <ul className="space-y-0.5 px-2">
          {channels.map((channel) => {
            const user = avatarOf?.(channel)
            const active = selectedId === channel.id
            const presence = presenceOf?.(channel)
            const unread = unreadByChannel?.get(channel.id) ?? 0
            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => onSelect(channel.id)}
                  className={cn(
                    'ts-row-hover flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[13px] transition',
                    active ? 'is-active font-medium text-foreground' : 'text-foreground/80',
                  )}
                >
                  {user ? (
                    <span className="relative shrink-0">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatarUrl || undefined} alt="" />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(user.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <PresenceDot
                        status={presence}
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    </span>
                  ) : (
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{labelOf(channel)}</span>
                  {unread > 0 && !active ? (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
