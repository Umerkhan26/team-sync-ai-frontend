import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Team } from '@/types'

export const teamApi = {
  list(params?: { page?: number; limit?: number }) {
    return apiGet<{ items: Team[] }>('/teams', params)
  },
  get(teamId: string) {
    return apiGet<{ team: Team }>(`/teams/${teamId}`).then((r) => r.data.team)
  },
  create(input: {
    name: string
    description?: string
    leadId?: string | null
    memberIds?: string[]
  }) {
    return apiPost<{ team: Team }>('/teams', input)
  },
  update(
    teamId: string,
    input: Partial<{
      name: string
      description: string
      leadId: string | null
      memberIds: string[]
    }>,
  ) {
    return apiPatch<{ team: Team }>(`/teams/${teamId}`, input)
  },
  remove(teamId: string) {
    return apiDelete<{ deleted: boolean }>(`/teams/${teamId}`)
  },
}
