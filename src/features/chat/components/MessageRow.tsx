import { MessageCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PresenceDot } from '@/components/shared/PresenceDot'
import { ReactionBar } from '@/features/chat/components/ReactionBar'
import { MessageAttachments } from '@/features/chat/components/MessageAttachments'
import { usePresence } from '@/hooks/usePresence'
import { formatDateTime, getInitials, cn } from '@/utils/cn'
import type { Message, User } from '@/types'

interface MessageRowProps {
  message: Message
  author: User | null
  currentUserId?: string
  onToggleReaction: (emoji: string) => void
  onOpenThread?: () => void
  isThreadReply?: boolean
}

export function MessageRow({
  message,
  author,
  currentUserId,
  onToggleReaction,
  onOpenThread,
  isThreadReply = false,
}: MessageRowProps) {
  const replyCount = message.replyCount ?? 0
  const { status } = usePresence(author?.id)

  return (
    <div className="group relative flex gap-3 rounded-lg px-2.5 py-2 transition ts-row-hover">
      <div className="relative mt-0.5 shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={author?.avatarUrl || undefined} alt="" />
          <AvatarFallback className="text-xs">{getInitials(author?.name || 'U')}</AvatarFallback>
        </Avatar>
        <PresenceDot status={status} className="absolute bottom-0 right-0" size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-semibold text-foreground">
            {author?.name || 'Member'}
          </span>
          <span className="text-[11px] text-muted-foreground">{formatDateTime(message.createdAt)}</span>
          {message.editedAt ? (
            <span className="text-[10px] text-muted-foreground">(edited)</span>
          ) : null}
        </div>
        {message.body ? (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/90">
            {message.body}
          </p>
        ) : null}
        <MessageAttachments attachments={message.attachments || []} />
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <ReactionBar
            reactions={message.reactions}
            currentUserId={currentUserId}
            onToggle={onToggleReaction}
          />
          {!isThreadReply ? (
            <button
              type="button"
              onClick={onOpenThread}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium transition',
                replyCount > 0
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100',
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
