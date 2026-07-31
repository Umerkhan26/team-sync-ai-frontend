import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTime, cn } from '@/utils/cn'
import type { Message } from '@/types'
import type { PinnedEntry } from '@/features/chat/utils/chatStorage'

interface PinnedMessagesStripProps {
  entries: PinnedEntry[]
  messagesById: Map<string, Message>
  onUnpin: (messageId: string) => void
  onJumpTo?: (messageId: string) => void
}

export function PinnedMessagesStrip({
  entries,
  messagesById,
  onUnpin,
  onJumpTo,
}: PinnedMessagesStripProps) {
  if (entries.length === 0) return null

  return (
    <div className="mb-3 space-y-1 rounded-lg border border-border/80 bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Pin className="h-3 w-3" />
        Pinned
      </div>
      <ul className="space-y-0.5">
        {entries.map((entry) => {
          const live = messagesById.get(entry.messageId)
          const body = live?.body || entry.body || '(message unavailable)'
          const author = entry.authorName || 'Member'
          const createdAt = live?.createdAt || entry.createdAt
          return (
            <li key={entry.messageId}>
              <div
                className={cn(
                  'ts-row-hover group flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition',
                  onJumpTo && 'cursor-pointer',
                )}
                onClick={() => onJumpTo?.(entry.messageId)}
                onKeyDown={(e) => {
                  if (onJumpTo && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onJumpTo(entry.messageId)
                  }
                }}
                role={onJumpTo ? 'button' : undefined}
                tabIndex={onJumpTo ? 0 : undefined}
              >
                <Pin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-foreground">
                    <span className="text-muted-foreground">{author}:</span> {body}
                  </p>
                  {createdAt ? (
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(createdAt)}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0 opacity-0 transition group-hover:opacity-100"
                  aria-label="Unpin message"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnpin(entry.messageId)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
