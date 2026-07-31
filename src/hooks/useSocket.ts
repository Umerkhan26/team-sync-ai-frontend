import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  connectSocket,
  disconnectSocket,
  joinOrgRoom,
  leaveOrgRoom,
} from '@/services/socket'
import { setPresenceSnapshot, upsertPresence, clearOrgPresence } from '@/store/presenceSlice'
import type { PresenceStatus } from '@/store/presenceSlice'

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

    const onNotification = () => {
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

    return () => {
      socket.off('notification:new', onNotification)
      socket.off('presence:snapshot', onPresenceSnapshot)
      socket.off('presence:update', onPresenceUpdate)
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
