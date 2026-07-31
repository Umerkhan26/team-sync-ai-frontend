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
        'relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-dashed border-border/80 bg-gradient-to-b from-card/80 to-muted/20 px-6 py-16 text-center',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div className="relative space-y-1.5">
        <h3 className="app-title text-base text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="sm" className="relative mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
