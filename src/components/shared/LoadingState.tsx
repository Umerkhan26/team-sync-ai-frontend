import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'

interface LoadingStateProps {
  rows?: number
  className?: string
  label?: string
  /** list = rows; page = header+stats+list; grid = cards; chat; settings; board */
  variant?: 'list' | 'page' | 'grid' | 'chat' | 'settings' | 'board'
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-48 sm:w-56" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  )
}

function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-panel space-y-3 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-14" />
        </div>
      ))}
    </div>
  )
}

function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="surface-panel overflow-hidden p-3">
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

function GridSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="surface-panel space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-[70%]" />
              <Skeleton className="h-3 w-[40%]" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-14 rounded-md" />
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="ts-chat-shell grid min-h-[min(70dvh,560px)] flex-1 overflow-hidden lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <aside className="ts-module-rail-flat flex flex-col gap-2 border-b p-2 lg:border-b-0 lg:border-r">
        <Skeleton className="h-8 w-full rounded-md" />
        <div className="space-y-1.5 pt-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md px-1 py-1.5">
              <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
              <Skeleton className="h-3 flex-1" style={{ width: `${50 + (i % 3) * 15}%` }} />
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn('flex gap-3', i % 2 === 1 && 'flex-row-reverse')}>
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className={cn('max-w-[70%] space-y-2', i % 2 === 1 && 'items-end')}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className={cn('h-14 rounded-xl', i % 3 === 0 ? 'w-56' : 'w-72 max-w-full')} />
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid items-stretch gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="ts-module-rail flex min-h-[12rem] flex-col gap-1.5 p-2 lg:min-h-[calc(100dvh-7.5rem)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-md px-3 py-2.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          <div className="surface-panel flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
            <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-9 w-full max-w-xs rounded-md" />
            </div>
          </div>
          <div className="surface-panel space-y-3 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full max-w-sm rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="surface-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-64 max-w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="surface-panel space-y-3 p-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
                <Skeleton className="h-3.5 w-[80%]" />
                <Skeleton className="h-3 w-[50%]" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-5 w-12 rounded" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadingState({
  rows = 4,
  className,
  label = 'Loading…',
  variant = 'list',
}: LoadingStateProps) {
  return (
    <div className={cn('w-full', className)} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {variant === 'page' ? (
        <div className="space-y-6">
          <HeaderSkeleton />
          <StatCardsSkeleton />
          <ListRowsSkeleton rows={rows} />
        </div>
      ) : null}
      {variant === 'list' ? <ListRowsSkeleton rows={rows} /> : null}
      {variant === 'grid' ? (
        <div className="space-y-6">
          <HeaderSkeleton />
          <GridSkeleton rows={rows} />
        </div>
      ) : null}
      {variant === 'chat' ? <ChatSkeleton /> : null}
      {variant === 'settings' ? <SettingsSkeleton /> : null}
      {variant === 'board' ? <BoardSkeleton /> : null}
    </div>
  )
}

/** Dashboard-style page skeleton (header + stats + rows) — matches typical module load. */
export function PageLoading({ className }: { className?: string }) {
  return <LoadingState variant="page" rows={4} className={className} label="Loading page…" />
}

/** Full app chrome skeleton: sidebar + topbar + content — used while auth/orgs bootstrap. */
export function AppShellSkeleton() {
  return (
    <div
      className="h-dvh max-h-dvh min-w-0 overflow-hidden lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading TeamSync AI"
    >
      <span className="sr-only">Loading application…</span>

      <aside className="ts-sidebar hidden h-dvh flex-col overflow-hidden border-r lg:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[color:var(--ts-sidebar-border)] px-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-2 py-3">
          <div className="space-y-1.5">
            <Skeleton className="mb-2 ml-2 h-2.5 w-16" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton
                  className="h-3"
                  style={{ width: `${55 + (i % 4) * 10}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-auto space-y-1.5 border-t border-[color:var(--ts-sidebar-border)] pt-3">
            <Skeleton className="mb-2 ml-2 h-2.5 w-14" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-3 w-[60%]" />
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="ts-content-frame flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="ts-topbar z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <Skeleton className="h-8 w-8 rounded-md lg:hidden" />
          <Skeleton className="hidden h-8 w-8 rounded-md lg:block" />
          <Skeleton className="h-8 w-36 rounded-md sm:w-44" />
          <Skeleton className="hidden h-3 w-20 md:block" />
          <div className="ml-auto flex items-center gap-1.5">
            <Skeleton className="hidden h-8 w-28 rounded-md sm:block" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>

        <main className="ts-main-canvas mx-auto w-full min-h-0 min-w-0 max-w-[1440px] flex-1 overflow-y-auto px-4 py-2.5 sm:px-6 lg:px-8">
          <PageLoading />
        </main>
      </div>
    </div>
  )
}
