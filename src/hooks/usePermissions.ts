import { useMemo } from 'react'
import { useAppSelector } from '@/store'

export type Permission =
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:billing'
  | 'members:read'
  | 'members:invite'
  | 'members:update'
  | 'members:remove'
  | 'roles:read'
  | 'roles:manage'
  | 'projects:create'
  | 'projects:read'
  | 'projects:update'
  | 'projects:delete'
  | 'tasks:create'
  | 'tasks:read'
  | 'tasks:update'
  | 'tasks:delete'
  | 'tasks:assign'
  | 'channels:create'
  | 'channels:read'
  | 'channels:update'
  | 'channels:delete'
  | 'messages:create'
  | 'messages:read'
  | 'messages:update'
  | 'messages:delete'
  | 'documents:create'
  | 'documents:read'
  | 'documents:update'
  | 'documents:delete'
  | 'files:upload'
  | 'files:read'
  | 'files:delete'
  | 'teams:read'
  | 'teams:create'
  | 'teams:update'
  | 'teams:delete'
  | 'meetings:read'
  | 'meetings:create'
  | 'meetings:update'
  | 'meetings:delete'
  | 'notifications:read'
  | 'analytics:read'
  | 'ai:use'
  | 'audit:read'

export function usePermissions() {
  const membership = useAppSelector((s) => s.org.activeMembership)
  const permissions = membership?.permissions ?? []
  const roleSlug = membership?.roleSlug ?? 'guest'
  const roleName = membership?.roleName ?? 'Guest'

  return useMemo(() => {
    const can = (required: Permission | Permission[]) => {
      const needed = Array.isArray(required) ? required : [required]
      return needed.every((p) => permissions.includes(p))
    }

    const canAny = (required: Permission[]) =>
      required.some((p) => permissions.includes(p))

    return {
      permissions,
      roleSlug,
      roleName,
      can,
      canAny,
      isOwner: roleSlug === 'owner',
      isAdmin: roleSlug === 'admin' || roleSlug === 'owner',
      isGuest: roleSlug === 'guest',
      canManageWorkspace: canAny(['members:invite', 'roles:manage', 'org:update', 'audit:read']),
    }
  }, [permissions, roleSlug, roleName])
}
