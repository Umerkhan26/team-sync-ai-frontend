import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { orgApi } from '@/services/orgApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveOrganization } from '@/store/orgSlice'
import { cn } from '@/utils/cn'

export function OrgSwitcher() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const activeOrg = useAppSelector((s) => s.org.activeOrganization)
  const membership = useAppSelector((s) => s.org.activeMembership)

  const { data: items = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => orgApi.list(),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-full justify-between gap-2 bg-card shadow-none"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{activeOrg?.name || 'Select workspace'}</span>
            {membership?.roleName ? (
              <Badge variant="secondary" className="hidden shrink-0 capitalize sm:inline-flex">
                {membership.roleName}
              </Badge>
            ) : null}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.organization.id}
            onClick={() =>
              dispatch(
                setActiveOrganization({
                  organization: item.organization,
                  membership: {
                    membershipId: item.membershipId,
                    roleId: item.roleId,
                    roleSlug: item.roleSlug || 'member',
                    roleName: item.roleName || 'Member',
                    permissions: item.permissions || [],
                    status: item.status,
                  },
                }),
              )
            }
          >
            <Check
              className={cn(
                'h-4 w-4',
                activeOrg?.id === item.organization.id ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className="min-w-0 flex-1 truncate">{item.organization.name}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {item.roleName || item.roleSlug}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/onboarding')}>
          <Plus className="h-4 w-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
