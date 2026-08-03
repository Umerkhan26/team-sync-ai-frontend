import { Bookmark, MessageCircle, Pin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PresenceDot } from '@/components/shared/PresenceDot'
import { ReactionBar } from '@/features/chat/components/ReactionBar'
import { MessageAttachments } from '@/features/chat/components/MessageAttachments'
import { splitMessageBody, type MentionUser } from '@/features/chat/utils/mentions'
import { usePresence } from '@/hooks/usePresence'
import { formatDateTime, getInitials, cn } from '@/utils/cn'
import type { Message, User } from '@/types'

interface MessageRowProps {
  message: Message
  author: User | null
  currentUserId?: string
  usersById?: Map<string, MentionUser>
  onToggleReaction: (emoji: string) => void
  onOpenThread?: () => void
  onPin?: () => void
  onUnpin?: () => void
  onBookmark?: () => void
  onRemoveBookmark?: () => void
  isPinned?: boolean
  isBookmarked?: boolean
  isThreadReply?: boolean
}

function MessageBody({
  body,
  usersById,
}: {
  body: string
  usersById?: Map<string, MentionUser>
}) {
  const parts = splitMessageBody(body, usersById || new Map())
  return (
    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <span
            key={`${part.userId}-${i}`}
            className="rounded bg-primary/15 px-1 py-0.5 font-medium text-primary"
            title={part.label}
          >
            @{part.label}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </p>
  )
}

export function MessageRow({
  message,
  author,
  currentUserId,
  usersById,
  onToggleReaction,
  onOpenThread,
  onPin,
  onUnpin,
  onBookmark,
  onRemoveBookmark,
  isPinned = false,
  isBookmarked = false,
  isThreadReply = false,
}: MessageRowProps) {
  const replyCount = message.replyCount ?? 0
  const { status } = usePresence(author?.id)

  return (
    <div
      id={`msg-${message.id}`}
      className="group relative flex min-w-0 gap-3 rounded-lg px-2.5 py-2 transition ts-row-hover"
    >
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
          {isPinned ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
              <Pin className="h-2.5 w-2.5" />
              Pinned
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {onPin || onUnpin ? (
              <button
                type="button"
                onClick={isPinned ? onUnpin : onPin}
                className={cn(
                  'rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground',
                  isPinned && 'text-primary opacity-100',
                )}
                title={isPinned ? 'Unpin message' : 'Pin message'}
                aria-label={isPinned ? 'Unpin message' : 'Pin message'}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onBookmark || onRemoveBookmark ? (
              <button
                type="button"
                onClick={isBookmarked ? onRemoveBookmark : onBookmark}
                className={cn(
                  'rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground',
                  isBookmarked && 'text-primary',
                )}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        {message.body ? <MessageBody body={message.body} usersById={usersById} /> : null}
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
