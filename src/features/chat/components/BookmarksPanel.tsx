import { Bookmark, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDateTime } from '@/utils/cn'
import type { BookmarkEntry } from '@/features/chat/utils/chatStorage'

interface BookmarksPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookmarks: BookmarkEntry[]
  onRemove: (id: string) => void
  onGoTo: (channelId: string, messageId: string) => void
}

export function BookmarksPanel({
  open,
  onOpenChange,
  bookmarks,
  onRemove,
  onGoTo,
}: BookmarksPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            Saved messages
          </SheetTitle>
          <SheetDescription>
            Saved messages synced to your account across devices.
          </SheetDescription>
        </SheetHeader>
        <div className="ts-scrollbar flex-1 overflow-y-auto px-5 pb-6">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Bookmark className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No bookmarks yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Use the message menu to save important messages here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2 pt-2">
              {bookmarks.map((bookmark) => (
                <li
                  key={bookmark.id}
                  className="ts-row-hover rounded-lg border border-border/70 p-3 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-primary">
                        {bookmark.channelLabel}
                      </p>
                      <p className="mt-0.5 line-clamp-3 text-[13px] text-foreground/90">
                        {bookmark.body || '(empty message)'}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {bookmark.authorName ? `${bookmark.authorName} · ` : ''}
                        {bookmark.messageCreatedAt
                          ? formatDateTime(bookmark.messageCreatedAt)
                          : formatDateTime(bookmark.savedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Go to message"
                        onClick={() => {
                          onGoTo(bookmark.channelId, bookmark.messageId)
                          onOpenChange(false)
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove bookmark"
                        onClick={() => onRemove(bookmark.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
