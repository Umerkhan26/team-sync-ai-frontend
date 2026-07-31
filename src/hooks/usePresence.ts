import { useCallback, useMemo } from 'react'
import { useAppSelector } from '@/store'
import { getSocket } from '@/services/socket'
import type { PresenceStatus } from '@/store/presenceSlice'

export function usePresence(userId?: string | null) {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const byUser = useAppSelector((s) => (orgId ? s.presence.byOrg[orgId] : undefined))

  const status: PresenceStatus = useMemo(() => {
    if (!userId || !byUser?.[userId]) return 'offline'
    return byUser[userId]!.status
  }, [byUser, userId])

  const setMyStatus = useCallback(
    (next: PresenceStatus) => {
      if (!orgId) return
      getSocket()?.emit('presence:set', { organizationId: orgId, status: next })
    },
    [orgId],
  )

  return { status, setMyStatus, onlineMap: byUser || {} }
}
