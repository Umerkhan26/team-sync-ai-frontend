import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  /**
   * `toolbar` (default): single compact row — Slack-like density for all modules.
   * `hero`: larger title block (rare; marketing-style pages).
   */
  variant?: 'toolbar' | 'hero'
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  variant = 'toolbar',
}: PageHeaderProps) {
  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'module-header mb-4 flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between',
          className,
        )}
      >
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="app-title text-xl leading-tight tracking-tight sm:text-2xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mb-3 flex min-h-10 items-center justify-between gap-3 border-b border-border/70 pb-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="app-title truncate text-base font-semibold tracking-tight sm:text-[17px]">
          {title}
        </h1>
        {description ? (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {description}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
