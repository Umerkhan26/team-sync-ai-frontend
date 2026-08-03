import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/store'
import { AppShellSkeleton, PageLoading } from '@/components/shared/LoadingState'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

export function ProtectedRoute({ requireVerified = true }: { requireVerified?: boolean }) {
  const location = useLocation()
  const { initialized, isLoading } = useAuthBootstrap()
  const user = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)

  if (!initialized || isLoading) {
    return <AppShellSkeleton />
  }

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (requireVerified && !user.emailVerifiedAt) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { initialized, isLoading } = useAuthBootstrap()
  const user = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)

  if (!initialized || isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl items-center p-8">
        <PageLoading className="w-full" />
      </div>
    )
  }

  if (accessToken && user?.emailVerifiedAt) {
    return <Navigate to="/app" replace />
  }

  if (accessToken && user && !user.emailVerifiedAt) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}
