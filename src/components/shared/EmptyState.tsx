import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div className="space-y-1.5">
        <h3 className="app-title text-base text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="sm" className="mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
