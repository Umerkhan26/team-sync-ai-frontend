import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'

export function PublicLayout() {
  useSurfaceMode('marketing')

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/brand/logo-mark.png"
            alt="TeamSync AI"
            className="h-8 w-8 rounded-lg object-cover shadow-sm mix-blend-multiply"
          />
          <span className="brand-mark text-2xl font-semibold sm:text-3xl">TeamSync AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
