import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  connectSocket,
  disconnectSocket,
  joinOrgRoom,
  leaveOrgRoom,
} from '@/services/socket'
import { setPresenceSnapshot, upsertPresence, clearOrgPresence } from '@/store/presenceSlice'
import type { PresenceStatus } from '@/store/presenceSlice'
import type { ApiSuccess, NotificationItem } from '@/types'
import { setNotificationsOpen } from '@/store/uiSlice'

function normalizeNotification(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  const id = String(n.id || n._id || '')
  if (!id) return null
  return {
    id,
    userId: String(n.userId || ''),
    organizationId: n.organizationId ? String(n.organizationId) : undefined,
    type: String(n.type || 'notification'),
    title: String(n.title || 'Notification'),
    body: n.body ? String(n.body) : '',
    data: (n.data as Record<string, unknown>) || {},
    readAt: n.readAt ? String(n.readAt) : null,
    createdAt: n.createdAt ? String(n.createdAt) : new Date().toISOString(),
  }
}

function prependNotification(
  queryClient: ReturnType<typeof useQueryClient>,
  item: NotificationItem,
) {
  queryClient.setQueriesData<{ data: { items: NotificationItem[] } }>(
    { queryKey: ['notifications'] },
    (prev) => {
      if (!prev?.data?.items) {
        return {
          success: true,
          data: { items: [item] },
        } as ApiSuccess<{ items: NotificationItem[] }>
      }
      if (prev.data.items.some((n) => n.id === item.id)) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          items: [item, ...prev.data.items],
        },
      }
    },
  )
}

export function useSocket() {
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(accessToken)

    const onNotification = (payload: unknown) => {
      const item = normalizeNotification(payload)
      if (item) {
        prependNotification(queryClient, item)
        toast(item.title, {
          description: item.body || undefined,
          action: {
            label: 'Open',
            onClick: () => dispatch(setNotificationsOpen(true)),
          },
        })
      }
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    const onPresenceSnapshot = (payload: {
      organizationId: string
      users: Array<{ userId: string; status: PresenceStatus; lastSeenAt?: string }>
    }) => {
      dispatch(setPresenceSnapshot(payload))
    }

    const onPresenceUpdate = (payload: {
      organizationId: string
      userId: string
      status: PresenceStatus
      lastSeenAt?: string
    }) => {
      dispatch(upsertPresence(payload))
    }

    socket.on('notification:new', onNotification)
    socket.on('presence:snapshot', onPresenceSnapshot)
    socket.on('presence:update', onPresenceUpdate)

    const onTaskUpdated = (payload: { projectId?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (payload?.projectId) {
        void queryClient.invalidateQueries({ queryKey: ['projects', payload.projectId] })
      }
    }

    const onProjectUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    }

    const onDocumentUpdated = (payload: { documentId?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      if (payload?.documentId) {
        void queryClient.invalidateQueries({ queryKey: ['document', payload.documentId] })
      }
    }

    socket.on('task:updated', onTaskUpdated)
    socket.on('project:updated', onProjectUpdated)
    socket.on('document:updated', onDocumentUpdated)

    return () => {
      socket.off('notification:new', onNotification)
      socket.off('presence:snapshot', onPresenceSnapshot)
      socket.off('presence:update', onPresenceUpdate)
      socket.off('task:updated', onTaskUpdated)
      socket.off('project:updated', onProjectUpdated)
      socket.off('document:updated', onDocumentUpdated)
    }
  }, [accessToken, queryClient, dispatch])

  useEffect(() => {
    if (!orgId || !accessToken) return
    joinOrgRoom(orgId)
    return () => {
      leaveOrgRoom(orgId)
      dispatch(clearOrgPresence(orgId))
    }
  }, [orgId, accessToken, dispatch])
}
