import type { Task } from '@/types'
import { isOverdue } from '@/utils/cn'

export type HealthVariant = 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'

export function projectHealthScore(tasks: Task[]): number | null {
  const active = tasks.filter((t) => t.status !== 'cancelled')
  if (!active.length) return null

  const done = active.filter((t) => t.status === 'done').length
  const completionScore = (done / active.length) * 100
  const overdueCount = active.filter(
    (t) => t.status !== 'done' && isOverdue(t.dueDate),
  ).length
  const penalty = Math.min(40, overdueCount * 10)

  return Math.max(0, Math.round(completionScore - penalty))
}

export function healthVariantFromScore(score: number): HealthVariant {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'destructive'
}
