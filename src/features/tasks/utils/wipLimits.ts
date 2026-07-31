import type { TaskStatus } from '@/types'

export type WipLimits = Partial<Record<TaskStatus, number>>

export const DEFAULT_WIP_LIMITS: WipLimits = {
  in_progress: 5,
  in_review: 3,
}

export function wipLimitsStorageKey(orgId: string) {
  return `ts-wip-limits-${orgId}`
}

export function loadWipLimits(orgId: string): WipLimits {
  try {
    const raw = localStorage.getItem(wipLimitsStorageKey(orgId))
    if (!raw) return { ...DEFAULT_WIP_LIMITS }
    const parsed = JSON.parse(raw) as WipLimits
    return { ...DEFAULT_WIP_LIMITS, ...parsed }
  } catch {
    return { ...DEFAULT_WIP_LIMITS }
  }
}

export function saveWipLimits(orgId: string, limits: WipLimits): void {
  localStorage.setItem(wipLimitsStorageKey(orgId), JSON.stringify(limits))
}

export function isOverWipLimit(count: number, limit: number | undefined): boolean {
  return limit != null && count > limit
}
