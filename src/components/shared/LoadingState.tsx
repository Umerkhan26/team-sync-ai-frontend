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
        <div
          key={index}
          className="surface-panel overflow-hidden p-3"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-[55%]" />
              <Skeleton className="h-3 w-[35%]" />
            </div>
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-panel p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-8 w-12" />
          </div>
        ))}
      </div>
      <LoadingState rows={4} />
    </div>
  )
}
