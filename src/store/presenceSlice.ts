import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type PresenceStatus = 'online' | 'away' | 'offline'

export interface PresenceUser {
  status: PresenceStatus
  lastSeenAt?: string
}

interface PresenceState {
  byOrg: Record<string, Record<string, PresenceUser>>
}

const initialState: PresenceState = {
  byOrg: {},
}

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setPresenceSnapshot(
      state,
      action: PayloadAction<{
        organizationId: string
        users: Array<{ userId: string; status: PresenceStatus; lastSeenAt?: string }>
      }>,
    ) {
      const map: Record<string, PresenceUser> = {}
      for (const user of action.payload.users) {
        if (user.status === 'offline') continue
        map[user.userId] = { status: user.status, lastSeenAt: user.lastSeenAt }
      }
      state.byOrg[action.payload.organizationId] = map
    },
    upsertPresence(
      state,
      action: PayloadAction<{
        organizationId: string
        userId: string
        status: PresenceStatus
        lastSeenAt?: string
      }>,
    ) {
      const { organizationId, userId, status, lastSeenAt } = action.payload
      if (!state.byOrg[organizationId]) state.byOrg[organizationId] = {}
      if (status === 'offline') {
        delete state.byOrg[organizationId]![userId]
        return
      }
      state.byOrg[organizationId]![userId] = { status, lastSeenAt }
    },
    clearOrgPresence(state, action: PayloadAction<string>) {
      delete state.byOrg[action.payload]
    },
  },
})

export const { setPresenceSnapshot, upsertPresence, clearOrgPresence } = presenceSlice.actions
export default presenceSlice.reducer
