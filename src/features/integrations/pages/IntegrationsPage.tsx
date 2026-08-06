import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Plug, RefreshCw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { integrationApi } from '@/services/integrationApi'
import { projectApi } from '@/services/projectApi'
import { useAppSelector } from '@/store'
import { usePermissions } from '@/hooks/usePermissions'
import { getErrorMessage, cn } from '@/utils/cn'
import type { IntegrationCatalogItem, IntegrationConnection, IntegrationProvider } from '@/types'

function connectionForProvider(
  connections: IntegrationConnection[],
  provider: string,
): IntegrationConnection | undefined {
  return connections.find(
    (c) => c.provider === provider && (c.status === 'connected' || c.status === 'pending' || c.status === 'error'),
  )
}

function statusBadge(status?: string) {
  if (status === 'connected') return <Badge variant="success">Connected</Badge>
  if (status === 'pending') return <Badge variant="warning">Pending OAuth</Badge>
  if (status === 'error') return <Badge variant="destructive">Error</Badge>
  return null
}

export function IntegrationsPage() {
  const orgId = useAppSelector((s) => s.org.activeOrganization?.id)
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [configureItem, setConfigureItem] = useState<IntegrationCatalogItem | null>(null)
  const [setupInfo, setSetupInfo] = useState<Record<string, unknown> | null>(null)

  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [slackBotToken, setSlackBotToken] = useState('')
  const [slackChannelId, setSlackChannelId] = useState('')
  const [slackIncomingUrl, setSlackIncomingUrl] = useState('')
  const [githubToken, setGitHubToken] = useState('')
  const [githubSecret, setGitHubSecret] = useState('')
  const [githubProjectId, setGitHubProjectId] = useState('')

  const integrationsQuery = useQuery({
    queryKey: ['integrations', orgId],
    queryFn: () => integrationApi.list(),
    enabled: Boolean(orgId) && can('org:read'),
  })

  const projectsQuery = useQuery({
    queryKey: ['projects', orgId, 'integrations'],
    queryFn: () => projectApi.list({ limit: 100 }),
    enabled: Boolean(orgId) && configureItem?.provider === 'github',
  })

  const projects = useMemo(
    () => (projectsQuery.data?.data.items ?? []).filter((p) => p.status !== 'archived'),
    [projectsQuery.data],
  )

  useEffect(() => {
    const oauth = searchParams.get('oauth')
    const provider = searchParams.get('provider')
    if (!oauth) return
    if (oauth === 'success') toast.success(`${provider || 'Integration'} connected`)
    if (oauth === 'error') {
      toast.error(searchParams.get('message') || 'OAuth failed')
    }
    searchParams.delete('oauth')
    searchParams.delete('provider')
    searchParams.delete('message')
    setSearchParams(searchParams, { replace: true })
    void queryClient.invalidateQueries({ queryKey: ['integrations', orgId] })
  }, [searchParams, setSearchParams, queryClient, orgId])

  const connectMutation = useMutation({
    mutationFn: (input: Parameters<typeof integrationApi.connect>[0]) =>
      integrationApi.connect(input),
    onSuccess: async (result) => {
      if (result.authUrl) {
        window.location.href = result.authUrl
        return
      }
      toast.success('Integration connected')
      if (result.setup) setSetupInfo(result.setup)
      setConfigureItem(null)
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

  const testMutation = useMutation({
    mutationFn: (connectionId: string) => integrationApi.test(connectionId),
    onSuccess: () => toast.success('Test event queued'),
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const openConfigure = (item: IntegrationCatalogItem) => {
    setWebhookUrl('')
    setWebhookSecret('')
    setSlackBotToken('')
    setSlackChannelId('')
    setSlackIncomingUrl('')
    setGitHubToken('')
    setGitHubSecret('')
    setGitHubProjectId('')
    setConfigureItem(item)
  }

  const submitConfigure = () => {
    if (!configureItem) return
    const provider = configureItem.provider as IntegrationProvider

    if (provider === 'webhook') {
      connectMutation.mutate({
        provider,
        displayName: configureItem.name,
        config: { url: webhookUrl },
        credentials: webhookSecret ? { webhookSecret } : undefined,
        startOAuth: false,
      })
      return
    }

    if (provider === 'slack') {
      if (configureItem.oauthReady && !slackBotToken && !slackIncomingUrl) {
        connectMutation.mutate({
          provider,
          displayName: configureItem.name,
          config: slackChannelId ? { channelId: slackChannelId } : {},
          startOAuth: true,
        })
        return
      }
      connectMutation.mutate({
        provider,
        displayName: configureItem.name,
        config: { channelId: slackChannelId },
        credentials: {
          ...(slackBotToken ? { botToken: slackBotToken } : {}),
          ...(slackIncomingUrl ? { incomingWebhookUrl: slackIncomingUrl } : {}),
        },
        startOAuth: false,
      })
      return
    }

    if (provider === 'github') {
      if (configureItem.oauthReady && !githubToken) {
        connectMutation.mutate({
          provider,
          displayName: configureItem.name,
          config: { defaultProjectId: githubProjectId },
          startOAuth: true,
        })
        return
      }
      connectMutation.mutate({
        provider,
        displayName: configureItem.name,
        config: { defaultProjectId: githubProjectId },
        credentials: {
          accessToken: githubToken,
          ...(githubSecret ? { webhookSecret: githubSecret } : {}),
        },
        startOAuth: false,
      })
      return
    }

    if (provider === 'google_calendar') {
      connectMutation.mutate({
        provider,
        displayName: configureItem.name,
        startOAuth: true,
      })
    }
  }

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
        description="Real outbound webhooks, Slack notifications, GitHub issue/PR → tasks, and Google Calendar meeting push."
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
            const comingSoon = item.authMode === 'coming_soon'
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
                  {comingSoon ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Soon
                    </Badge>
                  ) : (
                    statusBadge(connection?.status)
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                {connection?.errorMessage ? (
                  <p className="text-[11px] text-destructive">{connection.errorMessage}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2">
                  {comingSoon ? (
                    <Button size="sm" variant="outline" disabled>
                      Coming soon
                    </Button>
                  ) : connection?.status === 'connected' ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!can('org:update') || testMutation.isPending}
                        onClick={() => testMutation.mutate(connection.id)}
                      >
                        Send test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={!can('org:update') || disconnectMutation.isPending}
                        onClick={() => disconnectMutation.mutate(connection.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!can('org:update') || connectMutation.isPending}
                      onClick={() => openConfigure(item)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(configureItem)}
        onOpenChange={(open) => {
          if (!open) setConfigureItem(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect {configureItem?.name}</DialogTitle>
          </DialogHeader>

          {configureItem?.provider === 'webhook' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input
                  placeholder="https://example.com/hooks/teamsync"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Signing secret (optional)</Label>
                <Input
                  placeholder="Leave blank to auto-generate"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                TeamSync will POST JSON events with header{' '}
                <code className="text-[10px]">X-TeamSync-Signature: sha256=…</code>
              </p>
            </div>
          ) : null}

          {configureItem?.provider === 'slack' ? (
            <div className="space-y-3">
              {configureItem.oauthReady ? (
                <p className="text-xs text-muted-foreground">
                  OAuth is configured on the server. You can connect with Slack OAuth, or paste a bot
                  token / incoming webhook below.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Paste a Slack Bot token + channel ID, or an Incoming Webhook URL. Or set
                  SLACK_CLIENT_ID/SECRET for OAuth.
                </p>
              )}
              <div className="space-y-2">
                <Label>Bot token (xoxb-…)</Label>
                <Input
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                  placeholder="xoxb-…"
                />
              </div>
              <div className="space-y-2">
                <Label>Channel ID</Label>
                <Input
                  value={slackChannelId}
                  onChange={(e) => setSlackChannelId(e.target.value)}
                  placeholder="C0123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>Or Incoming Webhook URL</Label>
                <Input
                  value={slackIncomingUrl}
                  onChange={(e) => setSlackIncomingUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                />
              </div>
            </div>
          ) : null}

          {configureItem?.provider === 'github' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Default project (for new issues/PRs)</Label>
                <Select value={githubProjectId || undefined} onValueChange={setGitHubProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {configureItem.oauthReady ? (
                <p className="text-xs text-muted-foreground">
                  OAuth ready — leave token blank to authorize with GitHub, or paste a PAT.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>Personal access token</Label>
                <Input
                  value={githubToken}
                  onChange={(e) => setGitHubToken(e.target.value)}
                  placeholder="ghp_…"
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook secret (optional)</Label>
                <Input
                  value={githubSecret}
                  onChange={(e) => setGitHubSecret(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>
          ) : null}

          {configureItem?.provider === 'google_calendar' ? (
            <p className="text-sm text-muted-foreground">
              Continue to Google to grant Calendar access. Meetings created in TeamSync will be pushed
              to your calendar.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfigureItem(null)}>
              Cancel
            </Button>
            {configureItem?.oauthReady &&
            (configureItem.provider === 'slack' ||
              configureItem.provider === 'github' ||
              configureItem.provider === 'google_calendar') &&
            !(configureItem.provider === 'slack' && (slackBotToken || slackIncomingUrl)) &&
            !(configureItem.provider === 'github' && githubToken) ? (
              <Button
                type="button"
                disabled={connectMutation.isPending}
                onClick={() => submitConfigure()}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Continue with OAuth
              </Button>
            ) : (
              <Button
                type="button"
                disabled={
                  connectMutation.isPending ||
                  (configureItem?.provider === 'webhook' && !webhookUrl.trim()) ||
                  (configureItem?.provider === 'slack' &&
                    !configureItem.oauthReady &&
                    !slackBotToken &&
                    !slackIncomingUrl) ||
                  (configureItem?.provider === 'github' &&
                    !configureItem.oauthReady &&
                    !githubToken.trim())
                }
                onClick={() => submitConfigure()}
              >
                {connectMutation.isPending ? 'Connecting…' : 'Save & connect'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(setupInfo)} onOpenChange={(open) => !open && setSetupInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setup details</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {setupInfo
              ? Object.entries(setupInfo).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-border bg-muted/40 p-2">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">{key}</p>
                    <p className="break-all font-mono text-xs">{String(value)}</p>
                  </div>
                ))
              : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSetupInfo(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
