import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Organization, OrgMembershipSummary } from '@/types'

const ORG_KEY = 'teamsync_active_org'
const MEMBERSHIP_KEY = 'teamsync_active_membership'

export interface ActiveMembership {
  membershipId: string
  roleId: string
  roleSlug: string
  roleName: string
  permissions: string[]
  status: string
}

function readOrg(): Organization | null {
  try {
    const raw = localStorage.getItem(ORG_KEY)
    return raw ? (JSON.parse(raw) as Organization) : null
  } catch {
    return null
  }
}

function readMembership(): ActiveMembership | null {
  try {
    const raw = localStorage.getItem(MEMBERSHIP_KEY)
    return raw ? (JSON.parse(raw) as ActiveMembership) : null
  } catch {
    return null
  }
}

interface OrgState {
  activeOrganization: Organization | null
  activeMembership: ActiveMembership | null
  memberships: OrgMembershipSummary[]
}

const initialState: OrgState = {
  activeOrganization: readOrg(),
  activeMembership: readMembership(),
  memberships: [],
}

function persistMembership(membership: ActiveMembership | null) {
  if (membership) {
    localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(membership))
  } else {
    localStorage.removeItem(MEMBERSHIP_KEY)
  }
}

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setMemberships(state, action: PayloadAction<OrgMembershipSummary[]>) {
      state.memberships = action.payload
    },
    setActiveOrganization(
      state,
      action: PayloadAction<{
        organization: Organization | null
        membership?: ActiveMembership | null
      }>,
    ) {
      state.activeOrganization = action.payload.organization
      if (action.payload.organization) {
        localStorage.setItem(ORG_KEY, JSON.stringify(action.payload.organization))
      } else {
        localStorage.removeItem(ORG_KEY)
      }

      if (action.payload.membership !== undefined) {
        state.activeMembership = action.payload.membership
        persistMembership(action.payload.membership)
      } else if (!action.payload.organization) {
        state.activeMembership = null
        persistMembership(null)
      }
    },
    clearActiveOrganization(state) {
      state.activeOrganization = null
      state.activeMembership = null
      state.memberships = []
      localStorage.removeItem(ORG_KEY)
      persistMembership(null)
    },
  },
})

export const { setActiveOrganization, clearActiveOrganization, setMemberships } =
  orgSlice.actions
export default orgSlice.reducer
