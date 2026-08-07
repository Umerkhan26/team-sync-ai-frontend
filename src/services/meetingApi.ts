import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Meeting } from '@/types'

export const meetingApi = {
  list(params?: { page?: number; limit?: number; from?: string; to?: string }) {
    return apiGet<{ items: Meeting[] }>('/meetings', params)
  },
  get(meetingId: string) {
    return apiGet<{ meeting: Meeting }>(`/meetings/${meetingId}`).then(
      (r) => r.data.meeting,
    )
  },
  create(input: {
    title: string
    startsAt: string
    endsAt: string
    participantIds?: string[]
    agenda?: string
    notes?: string
    projectId?: string | null
    joinUrl?: string | null
  }) {
    return apiPost<{ meeting: Meeting }>('/meetings', input)
  },
  update(
    meetingId: string,
    input: Partial<{
      title: string
      startsAt: string
      endsAt: string
      participantIds: string[]
      agenda: string
      notes: string
      projectId: string | null
      joinUrl: string | null
      aiSummary: string | null
    }>,
  ) {
    return apiPatch<{ meeting: Meeting }>(`/meetings/${meetingId}`, input)
  },
  remove(meetingId: string) {
    return apiDelete<{ deleted: boolean }>(`/meetings/${meetingId}`)
  },
  summarize(meetingId: string) {
    return apiPost<{ meeting: Meeting }>(`/meetings/${meetingId}/summarize`)
  },
  setRsvp(meetingId: string, status: 'going' | 'maybe' | 'declined') {
    return apiPost<{ meeting: Meeting }>(`/meetings/${meetingId}/rsvp`, { status }).then(
      (r) => r.meeting,
    )
  },
}
