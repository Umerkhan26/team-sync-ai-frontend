import { apiGet } from './api'
import type { AuditLog } from '@/types'

export const auditApi = {
  list(params?: { page?: number; limit?: number; resource?: string }) {
    return apiGet<{ items: AuditLog[] }>('/audit-logs', params)
  },
}
