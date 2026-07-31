import { apiDelete, apiGet, apiPost } from './api'
import type { NotificationItem } from '@/types'

export const notificationApi = {
  list(params?: {
    page?: number
    limit?: number
    unreadOnly?: boolean
    organizationId?: string
  }) {
    return apiGet<{ items: NotificationItem[] }>('/notifications', {
      ...params,
      unreadOnly: params?.unreadOnly ? 'true' : undefined,
    })
  },
  markRead(notificationId: string) {
    return apiPost<{ notification: NotificationItem }>(
      `/notifications/${notificationId}/read`,
    )
  },
  markAllRead(organizationId?: string) {
    return apiPost<{ count: number }>('/notifications/read-all', {
      organizationId,
    })
  },
  remove(notificationId: string) {
    return apiDelete<{ deleted: boolean }>(`/notifications/${notificationId}`)
  },
}
