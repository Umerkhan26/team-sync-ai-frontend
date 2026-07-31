import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Project, ProjectStatus } from '@/types'

export const projectApi = {
  list(params?: { page?: number; limit?: number; status?: ProjectStatus }) {
    return apiGet<{ items: Project[] }>('/projects', params)
  },
  get(projectId: string) {
    return apiGet<{ project: Project }>(`/projects/${projectId}`).then(
      (r) => r.data.project,
    )
  },
  create(input: {
    name: string
    key?: string
    description?: string
    memberIds?: string[]
    teamId?: string | null
  }) {
    return apiPost<{ project: Project }>('/projects', input)
  },
  update(
    projectId: string,
    input: Partial<{
      name: string
      description: string
      status: ProjectStatus
      leadId: string | null
      memberIds: string[]
      teamId: string | null
    }>,
  ) {
    return apiPatch<{ project: Project }>(`/projects/${projectId}`, input)
  },
  remove(projectId: string) {
    return apiDelete<{ deleted: boolean }>(`/projects/${projectId}`)
  },
}
