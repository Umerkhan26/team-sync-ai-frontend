import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns a short relative label for a due date: Today / Tomorrow / Overdue / formatted date. */
export function getRelativeDueLabel(value?: string | Date | null): string | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null

  const today = startOfDay(new Date())
  const due = startOfDay(date)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays < 0) return 'Overdue'
  if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`
  return formatDate(date)
}

export function isOverdue(value?: string | Date | null): boolean {
  if (!value) return false
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return false
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime()
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybe = error as {
      response?: { data?: { error?: { message?: string } } }
      message?: string
    }
    return maybe.response?.data?.error?.message || maybe.message || fallback
  }
  return fallback
}
