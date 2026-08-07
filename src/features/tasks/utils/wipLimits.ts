import type { TaskStatus } from '@/types'

export type WipLimits = Partial<Record<TaskStatus, number>>

export const DEFAULT_WIP_LIMITS: WipLimits = {
  in_progress: 5,
  in_review: 3,
}

export function mergeWipLimits(stored?: Record<string, number> | null): WipLimits {
  return { ...DEFAULT_WIP_LIMITS, ...(stored || {}) }
}

export function isOverWipLimit(count: number, limit: number | undefined): boolean {
  return limit != null && count > limit
}
