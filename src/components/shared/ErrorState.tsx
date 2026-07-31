import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="app-title text-base text-foreground">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
