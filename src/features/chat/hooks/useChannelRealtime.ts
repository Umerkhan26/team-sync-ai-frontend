import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket, joinChannelRoom, leaveChannelRoom } from '@/services/socket'
import { useAppSelector } from '@/store'
import type { Message } from '@/types'

interface MessagesPage {
  data: { items: Message[] }
  meta?: unknown
}

export function messagesQueryKey(
  orgId: string | undefined,
  channelId: string,
  parentMessageId: string | null,
) {
  return ['messages', orgId, channelId, parentMessageId || 'root']
}

/** Joins the channel's socket room and keeps react-query message caches in sync in real time. */
export function useChannelRealtime(channelId: string | null, activeThreadId: string | null) {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const userId = useAppSelector((s) => s.auth.user?.id)
  const queryClient = useQueryClient()
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    setTypingUsers([])
    if (!orgId || !channelId) return

    joinChannelRoom(orgId, channelId)
    return () => {
      leaveChannelRoom(channelId)
    }
  }, [orgId, channelId])

  useEffect(() => {
    if (!orgId || !channelId) return
    const socket = getSocket()
    if (!socket) return

    const patchList = (parentMessageId: string | null, updater: (items: Message[]) => Message[]) => {
      const key = messagesQueryKey(orgId, channelId, parentMessageId)
      queryClient.setQueryData<MessagesPage>(key, (old) => {
        if (!old) return old
        return { ...old, data: { ...old.data, items: updater(old.data.items) } }
      })
    }

    const onNew = (message: Message) => {
      if (message.channelId !== channelId) return
      const parentId = message.parentMessageId || null
      patchList(parentId, (items) => {
        if (items.some((m) => m.id === message.id)) return items
        return [message, ...items]
      })
    }

    const onUpdated = (message: Message) => {
      const msgChannelId = String(message.channelId)
      if (msgChannelId !== channelId) return
      const msgId = String(message.id || (message as Message & { _id?: string })._id || '')
      const merge = (items: Message[]) =>
        items.map((m) => {
          if (String(m.id) !== msgId) return m
          return {
            ...m,
            ...message,
            id: m.id,
            replyCount: message.replyCount ?? m.replyCount,
            reactions: message.reactions ?? m.reactions,
          }
        })
      patchList(null, merge)
      if (message.parentMessageId) patchList(String(message.parentMessageId), merge)
      if (activeThreadId) patchList(activeThreadId, merge)
    }

    const onDeleted = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channelId) return
      patchList(null, (items) => items.filter((m) => m.id !== payload.id))
      if (activeThreadId) {
        patchList(activeThreadId, (items) => items.filter((m) => m.id !== payload.id))
      }
    }

    const onTypingStart = (payload: { channelId: string; userId: string }) => {
      if (payload.channelId !== channelId || payload.userId === userId) return
      setTypingUsers((prev) => (prev.includes(payload.userId) ? prev : [...prev, payload.userId]))
      const timers = typingTimers.current
      const existing = timers.get(payload.userId)
      if (existing) clearTimeout(existing)
      timers.set(
        payload.userId,
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== payload.userId))
          timers.delete(payload.userId)
        }, 4000),
      )
    }

    const onTypingStop = (payload: { channelId: string; userId: string }) => {
      if (payload.channelId !== channelId) return
      setTypingUsers((prev) => prev.filter((id) => id !== payload.userId))
      const timers = typingTimers.current
      const existing = timers.get(payload.userId)
      if (existing) clearTimeout(existing)
    }

    socket.on('message:new', onNew)
    socket.on('message:updated', onUpdated)
    socket.on('message:deleted', onDeleted)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)

    return () => {
      socket.off('message:new', onNew)
      socket.off('message:updated', onUpdated)
      socket.off('message:deleted', onDeleted)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
      for (const timer of typingTimers.current.values()) clearTimeout(timer)
      typingTimers.current.clear()
    }
  }, [orgId, channelId, activeThreadId, userId, queryClient])

  return { typingUsers }
}
