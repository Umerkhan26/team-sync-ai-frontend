import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/80">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="app-title text-xl leading-tight tracking-tight sm:text-[1.55rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
