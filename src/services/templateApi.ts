import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { TemplateKind, WorkspaceTemplate } from '@/types'

export type TemplateApplyResult = {
  kind: TemplateKind
  project?: { id: string; name?: string }
  tasks: Array<{ id: string; title?: string; number?: number }>
  documents: Array<{ id: string; title?: string }>
  task?: { id: string; title?: string; number?: number }
  document?: { id: string; title?: string }
}

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
  apply(input: {
    templateId?: string
    builtinId?: string
    projectId?: string
    overrides?: Record<string, unknown>
  }) {
    const path = input.templateId ? `/templates/${input.templateId}/apply` : '/templates/apply'
    return apiPost<{ result: TemplateApplyResult }>(path, {
      builtinId: input.builtinId,
      projectId: input.projectId,
      overrides: input.overrides,
    }).then((r) => r.result)
  },
}
