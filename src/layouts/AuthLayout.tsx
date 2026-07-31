import { Link, Outlet } from 'react-router-dom'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'

export function AuthLayout() {
  useSurfaceMode('marketing')

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(186_70%_78%/0.5),transparent_42%),radial-gradient(circle_at_85%_0%,hsl(210_65%_78%/0.38),transparent_38%),radial-gradient(circle_at_70%_85%,hsl(173_50%_80%/0.28),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/brand/logo-mark.png"
              alt=""
              className="h-10 w-10 rounded-xl shadow-md sm:h-11 sm:w-11"
            />
            <div>
              <p className="brand-mark text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                TeamSync AI
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Plan, sync, and ship in one workspace
              </p>
            </div>
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center pb-12">
          <div className="w-full max-w-md">
            <div className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-border/70">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
