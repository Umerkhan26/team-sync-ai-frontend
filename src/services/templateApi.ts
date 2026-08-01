import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { TemplateKind, WorkspaceTemplate } from '@/types'

export const templateApi = {
  list(kind?: TemplateKind) {
    return apiGet<{ items: WorkspaceTemplate[] }>('/templates', kind ? { kind } : undefined)
  },
  get(templateId: string) {
    return apiGet<{ template: WorkspaceTemplate }>(`/templates/${templateId}`).then(
      (r) => r.data.template,
    )
  },
  create(input: {
    kind: TemplateKind
    name: string
    description?: string
    payload?: Record<string, unknown>
  }) {
    return apiPost<{ template: WorkspaceTemplate }>('/templates', input)
  },
  update(
    templateId: string,
    input: Partial<{
      kind: TemplateKind
      name: string
      description: string
      payload: Record<string, unknown>
    }>,
  ) {
    return apiPatch<{ template: WorkspaceTemplate }>(`/templates/${templateId}`, input)
  },
  remove(templateId: string) {
    return apiDelete<{ deleted: boolean }>(`/templates/${templateId}`)
  },
}
