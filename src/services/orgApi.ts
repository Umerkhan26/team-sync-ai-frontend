import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type {
  Invitation,
  Membership,
  Organization,
  OrgMembershipSummary,
  Role,
  User,
} from '@/types'

export interface InvitePreview {
  email: string
  inviteeName?: string | null
  department?: string | null
  organization: { id: string; name: string; slug: string; logoUrl?: string | null }
  role: { name: string; slug: string }
  inviter: { name: string; email: string }
  expiresAt: string
  accountExists: boolean
}

export const orgApi = {
  list() {
    return apiGet<{ items: OrgMembershipSummary[] }>('/organizations').then(
      (r) => r.data.items,
    )
  },
  create(input: {
    name: string
    slug?: string
    companySize?: string
    industry?: string
    country?: string
    website?: string
    timezone?: string
    locale?: string
    logoUrl?: string | null
  }) {
    return apiPost<{ organization: Organization }>('/organizations', input)
  },
  remove(organizationId: string) {
    return apiDelete<{ deleted: boolean }>(`/organizations/${organizationId}`)
  },
  transferOwnership(organizationId: string, newOwnerUserId: string) {
    return apiPost<{ organization: Organization }>(
      `/organizations/${organizationId}/transfer-ownership`,
      { newOwnerUserId },
    )
  },
  get(organizationId: string) {
    return apiGet<{ organization: Organization; membership: unknown }>(
      `/organizations/${organizationId}`,
    ).then((r) => r.data)
  },
  update(
    organizationId: string,
    input: Partial<{
      name: string
      logoUrl: string | null
      companySize: string | null
      industry: string | null
      country: string | null
      website: string | null
      timezone: string
      locale: string
      accentColor: string | null
      settings: { allowGuestInvites: boolean; defaultRoleSlug: string }
      onboarding: Partial<{
        profileCompleted: boolean
        invitedMembers: boolean
        createdProject: boolean
        tourCompleted: boolean
      }>
    }>,
  ) {
    return apiPatch<{ organization: Organization }>(
      `/organizations/${organizationId}`,
      input,
    )
  },
  invite(
    organizationId: string,
    input: {
      email: string
      roleSlug?: string
      inviteeName?: string
      department?: string
    },
  ) {
    return apiPost<{ invitation: Invitation; token?: string }>(
      `/organizations/${organizationId}/invitations`,
      input,
    )
  },
  listInvitations(organizationId: string) {
    return apiGet<{ items: Invitation[] }>(
      `/organizations/${organizationId}/invitations`,
    ).then((r) => r.data.items)
  },
  /**
   * NOTE: Backend endpoint may land slightly later — expects
   * `POST /organizations/:orgId/invitations/:inviteId/revoke`.
   */
  revokeInvite(organizationId: string, inviteId: string) {
    return apiPost<{ invitation: Invitation }>(
      `/organizations/${organizationId}/invitations/${inviteId}/revoke`,
    )
  },
  /**
   * NOTE: Backend endpoint may land slightly later — expects
   * `POST /organizations/:orgId/invitations/:inviteId/resend`.
   */
  resendInvite(organizationId: string, inviteId: string) {
    return apiPost<{ invitation: Invitation; token?: string }>(
      `/organizations/${organizationId}/invitations/${inviteId}/resend`,
    )
  },
  previewInvite(token: string) {
    return apiGet<{ invitation: InvitePreview }>('/organizations/invitations/preview', {
      token,
    }).then((r) => r.data.invitation)
  },
  activateInvite(input: { token: string; name: string; password: string }) {
    return apiPost<{
      user: User
      accessToken: string
      refreshToken: string
      organizationId: string
      membership: Membership
    }>('/organizations/invitations/activate', input)
  },
  acceptInvite(token: string) {
    return apiPost<{ membership: Membership }>('/organizations/invitations/accept', {
      token,
    })
  },
  listMembers(organizationId: string) {
    return apiGet<{ items: Membership[] }>(
      `/organizations/${organizationId}/members`,
    ).then((r) => r.data.items)
  },
  updateMember(
    organizationId: string,
    membershipId: string,
    input: { roleSlug?: string; status?: 'active' | 'suspended' },
  ) {
    return apiPatch<{ membership: Membership }>(
      `/organizations/${organizationId}/members/${membershipId}`,
      input,
    )
  },
  removeMember(organizationId: string, membershipId: string) {
    return apiDelete<{ removed: boolean }>(
      `/organizations/${organizationId}/members/${membershipId}`,
    )
  },
  listRoles(organizationId: string) {
    return apiGet<{ items: Role[] }>(`/organizations/${organizationId}/roles`).then(
      (r) => r.data.items,
    )
  },
  createRole(
    organizationId: string,
    input: { name: string; slug?: string; description?: string; permissions: string[] },
  ) {
    return apiPost<{ role: Role }>(`/organizations/${organizationId}/roles`, input)
  },
  updateRole(
    organizationId: string,
    roleId: string,
    input: Partial<{ name: string; description: string; permissions: string[] }>,
  ) {
    return apiPatch<{ role: Role }>(
      `/organizations/${organizationId}/roles/${roleId}`,
      input,
    )
  },
  deleteRole(organizationId: string, roleId: string) {
    return apiDelete<{ deleted: boolean }>(
      `/organizations/${organizationId}/roles/${roleId}`,
    )
  },
  bulkInvite(
    organizationId: string,
    invitations: Array<{
      email: string
      inviteeName?: string
      roleSlug?: string
      department?: string
    }>,
  ) {
    return apiPost<{
      results: Array<{
        email: string
        ok: boolean
        error?: string
        invitationId?: string
        token?: string
      }>
      invited: number
    }>(`/organizations/${organizationId}/invitations/bulk`, { invitations })
  },
}
