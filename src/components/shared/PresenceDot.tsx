import { cn } from '@/utils/cn'
import type { PresenceStatus } from '@/store/presenceSlice'

const STATUS_CLASS: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  offline: 'bg-muted-foreground/40',
}

interface PresenceDotProps {
  status?: PresenceStatus | null
  className?: string
  size?: 'sm' | 'md'
}

export function PresenceDot({ status, className, size = 'sm' }: PresenceDotProps) {
  const resolved = status || 'offline'
  return (
    <span
      title={resolved}
      className={cn(
        'inline-block rounded-full ring-2 ring-card',
        size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
        STATUS_CLASS[resolved],
        className,
      )}
    />
  )
}
