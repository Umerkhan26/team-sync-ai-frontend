/** Mirrors backend/src/config/permissions.ts — keep in sync. */
export const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: 'Organization',
    permissions: ['org:read', 'org:update', 'org:delete', 'org:billing'],
  },
  {
    label: 'Members',
    permissions: ['members:read', 'members:invite', 'members:update', 'members:remove'],
  },
  {
    label: 'Roles',
    permissions: ['roles:read', 'roles:manage'],
  },
  {
    label: 'Projects',
    permissions: ['projects:create', 'projects:read', 'projects:update', 'projects:delete'],
  },
  {
    label: 'Tasks',
    permissions: [
      'tasks:create',
      'tasks:read',
      'tasks:update',
      'tasks:delete',
      'tasks:assign',
    ],
  },
  {
    label: 'Channels & messages',
    permissions: [
      'channels:create',
      'channels:read',
      'channels:update',
      'channels:delete',
      'messages:create',
      'messages:read',
      'messages:update',
      'messages:delete',
    ],
  },
  {
    label: 'Documents',
    permissions: ['documents:create', 'documents:read', 'documents:update', 'documents:delete'],
  },
  {
    label: 'Files',
    permissions: ['files:upload', 'files:read', 'files:delete'],
  },
  {
    label: 'Teams',
    permissions: ['teams:read', 'teams:create', 'teams:update', 'teams:delete'],
  },
  {
    label: 'Meetings',
    permissions: ['meetings:read', 'meetings:create', 'meetings:update', 'meetings:delete'],
  },
  {
    label: 'Other',
    permissions: ['notifications:read', 'analytics:read', 'ai:use', 'audit:read'],
  },
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions)
