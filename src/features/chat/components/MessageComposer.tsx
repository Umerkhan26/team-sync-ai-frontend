import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Paperclip, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getErrorMessage, getInitials } from '@/utils/cn'
import { fileApi } from '@/services/fileApi'
import {
  applyMentionReplacement,
  filterMentionCandidates,
  getMentionQueryAtCaret,
  type MentionUser,
} from '@/features/chat/utils/mentions'
import type { MessageAttachment } from '@/types'

interface PendingUpload {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'done' | 'error'
  attachment?: MessageAttachment
  previewUrl?: string
}

interface MessageComposerProps {
  placeholder: string
  onSend: (body: string, attachments: MessageAttachment[]) => void
  onTyping?: (value: string) => void
  sending?: boolean
  autoFocus?: boolean
  className?: string
  /** Org/channel members available for @mentions */
  mentionUsers?: MentionUser[]
  currentUserId?: string
}

const MAX_TEXTAREA_HEIGHT = 160
const PREVIEW_GRID_CAP = 4

export function MessageComposer({
  placeholder,
  onSend,
  onTyping,
  sending,
  autoFocus,
  className,
  mentionUsers = [],
  currentUserId,
}: MessageComposerProps) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mentionOptions = useMemo(
    () => filterMentionCandidates(mentionUsers, mentionQuery, currentUserId),
    [mentionUsers, mentionQuery, currentUserId],
  )

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionQuery, mentionOpen])

  const resizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }

  const syncMentionState = (value: string, caret: number) => {
    const hit = getMentionQueryAtCaret(value, caret)
    if (!hit || mentionUsers.length === 0) {
      setMentionOpen(false)
      return
    }
    setMentionOpen(true)
    setMentionStart(hit.start)
    setMentionQuery(hit.query)
  }

  const uploadFile = (upload: PendingUpload) => {
    fileApi
      .upload(upload.file, {
        onProgress: (percent) => {
          setPending((prev) => prev.map((p) => (p.id === upload.id ? { ...p, progress: percent } : p)))
        },
      })
      .then((result) => {
        setPending((prev) =>
          prev.map((p) =>
            p.id === upload.id
              ? {
                  ...p,
                  status: 'done',
                  progress: 100,
                  attachment: {
                    url: result.secureUrl || result.url,
                    fileName: result.fileName,
                    mimeType: result.mimeType,
                    fileAssetId: result.id,
                  },
                }
              : p,
          ),
        )
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, 'Upload failed'))
        setPending((prev) => prev.map((p) => (p.id === upload.id ? { ...p, status: 'error' } : p)))
      })
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const uploads: PendingUpload[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'uploading',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setPending((prev) => [...prev, ...uploads])
    uploads.forEach(uploadFile)
  }

  const removePending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const insertMention = (user: MentionUser) => {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? text.length
    const { next, nextCaret } = applyMentionReplacement(text, mentionStart, caret, user.id)
    setText(next)
    setMentionOpen(false)
    onTyping?.(next)
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(nextCaret, nextCaret)
      resizeTextarea(textareaRef.current)
    })
  }

  const isUploading = pending.some((p) => p.status === 'uploading')
  const readyAttachments = pending.filter((p) => p.status === 'done' && p.attachment)
  const hasFailed = pending.some((p) => p.status === 'error')
  const canSend = !sending && !isUploading && (text.trim().length > 0 || readyAttachments.length > 0)

  const imagePending = pending.filter((p) => p.previewUrl)
  const filePending = pending.filter((p) => !p.previewUrl)
  const visibleImages = imagePending.slice(0, PREVIEW_GRID_CAP)
  const extraImages = Math.max(0, imagePending.length - PREVIEW_GRID_CAP)

  const handleSend = () => {
    if (!canSend) return
    const attachments = readyAttachments.map((p) => p.attachment!)
    onSend(text.trim(), attachments)
    setText('')
    setMentionOpen(false)
    pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    setPending([])
    requestAnimationFrame(() => resizeTextarea(textareaRef.current))
  }

  return (
    <form
      className={cn('relative border-t border-border bg-card px-3 py-2.5', className)}
      onSubmit={(e) => {
        e.preventDefault()
        handleSend()
      }}
    >
      {pending.length > 0 ? (
        <div className="mb-2 space-y-2">
          {imagePending.length > 0 ? (
            <div className="grid max-w-sm grid-cols-2 gap-1.5 sm:grid-cols-4">
              {visibleImages.map((p, i) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  {i === visibleImages.length - 1 && extraImages > 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                      +{extraImages}
                    </div>
                  ) : null}
                  {p.status === 'uploading' ? (
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-center text-[10px] text-white">
                      {p.progress}%
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    className="absolute right-1 top-1 rounded-md bg-black/55 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`Remove ${p.file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {filePending.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filePending.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                    p.status === 'error'
                      ? 'border-destructive/40 bg-destructive/10'
                      : 'border-border bg-secondary/50',
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="max-w-[140px] truncate">{p.file.name}</span>
                  {p.status === 'uploading' ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {p.progress}%
                    </span>
                  ) : p.status === 'error' ? (
                    <span className="text-destructive">Failed</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    className="rounded p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    aria-label={`Remove ${p.file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mentionOpen && mentionOptions.length > 0 ? (
        <div
          className="absolute bottom-[calc(100%-0.25rem)] left-3 right-3 z-20 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg sm:left-auto sm:right-3 sm:w-72"
          role="listbox"
          aria-label="Mention suggestions"
        >
          {mentionOptions.map((user, i) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={i === mentionIndex}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                i === mentionIndex ? 'bg-accent' : 'hover:bg-accent/70',
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(user)
              }}
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.avatarUrl || undefined} alt="" />
                <AvatarFallback className="text-[10px]">
                  {getInitials(user.name || user.email || 'U')}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium">{user.name || 'Member'}</span>
              <span className="max-w-[40%] truncate text-[11px] text-muted-foreground">
                {user.email}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 shadow-sm transition focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/25">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mb-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => {
            const value = e.target.value
            setText(value)
            onTyping?.(value)
            resizeTextarea(e.target)
            syncMentionState(value, e.target.selectionStart ?? value.length)
          }}
          onClick={(e) => {
            const el = e.currentTarget
            syncMentionState(el.value, el.selectionStart ?? el.value.length)
          }}
          onKeyUp={(e) => {
            const el = e.currentTarget
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              syncMentionState(el.value, el.selectionStart ?? el.value.length)
            }
          }}
          onKeyDown={(e) => {
            if (mentionOpen && mentionOptions.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionIndex((i) => (i + 1) % mentionOptions.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length)
                return
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                insertMention(mentionOptions[mentionIndex]!)
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setMentionOpen(false)
                return
              }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="max-h-40 min-h-[36px] flex-1 resize-none border-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={!canSend}
          className="mb-0.5 shrink-0"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {hasFailed ? (
        <p className="mt-1 text-[11px] text-destructive">
          Some attachments failed to upload — remove them or try again.
        </p>
      ) : (
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          Enter to send · Shift + Enter new line · @ to mention
        </p>
      )}
    </form>
  )
}
