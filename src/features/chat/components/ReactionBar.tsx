import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utils/cn'
import type { MessageReaction } from '@/types'

const PICKER_EMOJIS = [
  '👍',
  '❤️',
  '🎉',
  '😂',
  '😮',
  '😢',
  '🔥',
  '✅',
  '👀',
  '👏',
  '🚀',
  '💡',
]

interface ReactionBarProps {
  reactions?: MessageReaction[]
  currentUserId?: string
  onToggle: (emoji: string) => void
  className?: string
}

export function ReactionBar({ reactions, currentUserId, onToggle, className }: ReactionBarProps) {
  const [open, setOpen] = useState(false)
  const active = (reactions || []).filter((r) => (r.userIds?.length || 0) > 0)

  const pick = (emoji: string) => {
    onToggle(emoji)
    setOpen(false)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {active.map((reaction) => {
        const mine = currentUserId ? reaction.userIds.map(String).includes(currentUserId) : false
        return (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onToggle(reaction.emoji)}
            title={mine ? 'Remove your reaction' : 'Add reaction'}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[12px] transition',
              mine
                ? 'border-primary/45 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--ts-primary)/0.15)]'
                : 'border-border/80 bg-secondary/70 text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground',
            )}
          >
            <span className="text-[13px] leading-none">{reaction.emoji}</span>
            <span className="tabular-nums font-medium leading-none">{reaction.userIds.length}</span>
          </button>
        )
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add reaction"
            className={cn(
              'inline-flex h-7 items-center justify-center gap-0.5 rounded-full border border-border/80 bg-secondary/70 px-2 text-muted-foreground transition',
              'hover:border-border hover:bg-secondary hover:text-foreground',
              active.length === 0 && 'sm:opacity-0 sm:group-hover:opacity-100',
              (open || active.length > 0) && 'opacity-100',
              open && 'border-primary/40 text-primary',
            )}
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2" sideOffset={6}>
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            React
          </p>
          <div className="grid grid-cols-6 gap-0.5">
            {PICKER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-base transition hover:bg-accent"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
