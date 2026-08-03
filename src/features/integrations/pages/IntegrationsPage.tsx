import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { integrationApi } from '@/services/integrationApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage, cn } from '@/utils/cn'
import type { IntegrationCatalogItem, IntegrationConnection } from '@/types'

function connectionForProvider(
  connections: IntegrationConnection[],
  provider: string,
): IntegrationConnection | undefined {
  return connections.find((c) => c.provider === provider && c.status === 'connected')
}

export function IntegrationsPage() {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const { can } = usePermissions()

  const integrationsQuery = useQuery({
    queryKey: ['integrations', orgId],
    queryFn: () => integrationApi.list(),
    enabled: Boolean(orgId) && can('org:read'),
  })

  const connectMutation = useMutation({
    mutationFn: (item: IntegrationCatalogItem) =>
      integrationApi.connect({ provider: item.provider, displayName: item.name }),
    onSuccess: async () => {
      toast.success('Integration connected')
      await queryClient.invalidateQueries({ queryKey: ['integrations', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) => integrationApi.disconnect(connectionId),
    onSuccess: async () => {
      toast.success('Integration disconnected')
      await queryClient.invalidateQueries({ queryKey: ['integrations', orgId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (!can('org:read')) {
    return (
      <EmptyState
        title="No access"
        description="Your role cannot view workspace integrations."
      />
    )
  }

  const catalog = integrationsQuery.data?.catalog ?? []
  const connections = integrationsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connect"
        title="Integrations"
        description="Connect TeamSync AI to the tools your team already uses."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={integrationsQuery.isFetching}
            onClick={() => void integrationsQuery.refetch()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', integrationsQuery.isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {!orgId ? (
        <EmptyState title="Select an organization" />
      ) : integrationsQuery.isLoading ? (
        <LoadingState variant="grid" rows={6} />
      ) : integrationsQuery.isError ? (
        <ErrorState onRetry={() => void integrationsQuery.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((item) => {
            const connection = connectionForProvider(connections, item.provider)
            const connected = Boolean(connection)
            return (
              <div
                key={item.provider}
                className="surface-panel flex flex-col gap-3 p-4 transition hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Plug className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                  {connected ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Connected
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                <div className="mt-auto flex gap-2">
                  {connected && connection ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={!can('org:update') || disconnectMutation.isPending}
                      onClick={() => disconnectMutation.mutate(connection.id)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!can('org:update') || connectMutation.isPending}
                      onClick={() => connectMutation.mutate(item)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
