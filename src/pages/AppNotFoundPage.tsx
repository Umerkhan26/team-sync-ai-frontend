import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'

export function AppNotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-10">
      <EmptyState
        title="Page not found"
        description="That app route does not exist. Head home or use search (⌘K) to jump elsewhere."
      />
      <Button asChild className="mt-4" size="sm">
        <Link to="/app">Back to Home</Link>
      </Button>
    </div>
  )
}
