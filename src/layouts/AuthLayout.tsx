import { Link, Outlet } from 'react-router-dom'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'

export function AuthLayout() {
  useSurfaceMode('marketing')

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(186_70%_78%/0.45),transparent_40%),radial-gradient(circle_at_80%_0%,hsl(210_70%_80%/0.4),transparent_35%),radial-gradient(circle_at_70%_80%,hsl(173_55%_82%/0.35),transparent_40%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-10">
          <Link to="/" className="brand-mark text-3xl font-semibold text-foreground sm:text-4xl">
            TeamSync AI
          </Link>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Multi-tenant workspaces with role-based access—plan, sync, and ship with AI.
          </p>
        </header>
        <main className="flex flex-1 items-start justify-center">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
