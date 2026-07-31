import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orgApi } from '@/services/orgApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveOrganization, setMemberships } from '@/store/orgSlice'
import type { OrgMembershipSummary } from '@/types'

function toMembership(item: OrgMembershipSummary) {
  return {
    membershipId: item.membershipId,
    roleId: item.roleId,
    roleSlug: item.roleSlug || 'member',
    roleName: item.roleName || 'Member',
    permissions: item.permissions || [],
    status: item.status,
  }
}

export function useOrganizationsSync() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const user = useAppSelector((s) => s.auth.user)
  const activeOrgId = useAppSelector((s) => s.org.activeOrganization?.id)

  const query = useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgApi.list(),
    enabled: Boolean(accessToken && user?.emailVerifiedAt),
  })

  useEffect(() => {
    if (!query.data) return

    dispatch(setMemberships(query.data))

    if (!query.data.length) {
      dispatch(setActiveOrganization({ organization: null, membership: null }))
      return
    }

    const match =
      query.data.find((item) => item.organization.id === activeOrgId) ?? query.data[0]!

    dispatch(
      setActiveOrganization({
        organization: match.organization,
        membership: toMembership(match),
      }),
    )
  }, [query.data, dispatch, activeOrgId])

  return query
}
