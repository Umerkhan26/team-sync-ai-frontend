import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'

interface LoadingStateProps {
  rows?: number
  className?: string
  label?: string
}

export function LoadingState({
  rows = 4,
  className,
  label = 'Loading…',
}: LoadingStateProps) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <LoadingState rows={5} />
    </div>
  )
}
