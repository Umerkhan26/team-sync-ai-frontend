import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { IntegrationCatalogItem, IntegrationConnection, IntegrationProvider } from '@/types'

export const integrationApi = {
  catalog() {
    return apiGet<{ catalog: IntegrationCatalogItem[] }>('/integrations/catalog').then(
      (r) => r.data.catalog,
    )
  },
  list() {
    return apiGet<{
      items: IntegrationConnection[]
      catalog: IntegrationCatalogItem[]
    }>('/integrations').then((r) => r.data)
  },
  connect(input: {
    provider: IntegrationProvider
    displayName?: string
    config?: Record<string, unknown>
    credentials?: Record<string, string>
    startOAuth?: boolean
  }) {
    return apiPost<{
      connection: IntegrationConnection
      authUrl?: string | null
      setup?: Record<string, unknown> | null
    }>('/integrations/connect', input)
  },
  update(
    connectionId: string,
    input: { config?: Record<string, unknown>; credentials?: Record<string, string> },
  ) {
    return apiPatch<{ connection: IntegrationConnection }>(
      `/integrations/${connectionId}`,
      input,
    )
  },
  test(connectionId: string) {
    return apiPost<{ queued: boolean }>(`/integrations/${connectionId}/test`, {})
  },
  disconnect(connectionId: string) {
    return apiDelete<{ deleted: boolean }>(`/integrations/${connectionId}`)
  },
}
