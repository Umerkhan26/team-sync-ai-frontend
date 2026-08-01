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
  }) {
    return apiPost<{ connection: IntegrationConnection }>('/integrations/connect', input)
  },
  update(connectionId: string, config: Record<string, unknown>) {
    return apiPatch<{ connection: IntegrationConnection }>(
      `/integrations/${connectionId}`,
      { config },
    )
  },
  disconnect(connectionId: string) {
    return apiDelete<{ deleted: boolean }>(`/integrations/${connectionId}`)
  },
}
