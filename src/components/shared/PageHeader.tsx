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
        'module-header mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="app-title text-[1.35rem] leading-tight tracking-tight sm:text-[1.65rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  )
}
