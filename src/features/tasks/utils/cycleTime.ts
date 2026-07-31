import type { Task } from '@/types'

export function taskCycleTimeMs(task: Task): number | null {
  if (task.status !== 'done') return null
  const endRaw = task.completedAt || task.updatedAt
  const startRaw = task.createdAt
  if (!endRaw || !startRaw) return null
  const end = new Date(endRaw).getTime()
  const start = new Date(startRaw).getTime()
  if (Number.isNaN(end) || Number.isNaN(start) || end < start) return null
  return end - start
}

export function formatCycleTime(ms: number): string {
  const hours = ms / (1000 * 60 * 60)
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`
  const days = hours / 24
  if (days < 14) return `${Math.round(days * 10) / 10}d`
  return `${Math.round(days)}d`
}

export function averageCycleTimeMs(tasks: Task[]): number | null {
  const samples = tasks.map(taskCycleTimeMs).filter((v): v is number => v != null)
  if (!samples.length) return null
  return samples.reduce((sum, v) => sum + v, 0) / samples.length
}
