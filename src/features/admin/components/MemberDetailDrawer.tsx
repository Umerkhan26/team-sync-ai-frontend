import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, getInitials } from '@/utils/cn'
import type { Membership, Role, User } from '@/types'

interface MemberDetailDrawerProps {
  membership: Membership | null
  onOpenChange: (open: boolean) => void
  roles: Role[]
  canManage: boolean
  onSuspend: (membershipId: string) => void
  onActivate: (membershipId: string) => void
  onRemove: (membershipId: string) => void
  suspendPending?: boolean
}

function memberUser(membership: Membership | null): User | null {
  if (!membership) return null
  return typeof membership.userId === 'object' ? (membership.userId as User) : null
}

export function MemberDetailDrawer({
  membership,
  onOpenChange,
  roles,
  canManage,
  onSuspend,
  onActivate,
  onRemove,
  suspendPending,
}: MemberDetailDrawerProps) {
  const user = memberUser(membership)
  const roleSlug =
    membership && typeof membership.roleId === 'object'
      ? membership.roleId.slug
      : roles.find((r) => r.id === membership?.roleId)?.slug
  const role = roles.find((r) => r.slug === roleSlug)

  return (
    <Sheet open={Boolean(membership)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Member profile</SheetTitle>
          <SheetDescription>Profile, role, and status for this teammate.</SheetDescription>
        </SheetHeader>
        {membership ? (
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.avatarUrl || undefined} alt="" />
                <AvatarFallback className="text-base">
                  {getInitials(user?.name || user?.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{user?.name || 'Unknown user'}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <dl className="surface-panel divide-y divide-border overflow-hidden text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium capitalize">{role?.name || roleSlug || '—'}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    variant={membership.status === 'active' ? 'success' : 'warning'}
                    className="capitalize"
                  >
                    {membership.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Member since</dt>
                <dd className="font-medium">{formatDateTime(membership.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Account status</dt>
                <dd className="font-medium capitalize">{user?.status || '—'}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Email verified</dt>
                <dd className="font-medium">{user?.emailVerifiedAt ? 'Yes' : 'No'}</dd>
              </div>
            </dl>

            {canManage ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {membership.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={suspendPending}
                    onClick={() => onSuspend(membership.id)}
                  >
                    Suspend member
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={suspendPending}
                    onClick={() => onActivate(membership.id)}
                  >
                    Activate member
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => onRemove(membership.id)}
                >
                  Remove from workspace
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
