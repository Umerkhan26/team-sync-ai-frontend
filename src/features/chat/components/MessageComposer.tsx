import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Paperclip, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, getErrorMessage } from '@/utils/cn'
import { fileApi } from '@/services/fileApi'
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
}

const MAX_TEXTAREA_HEIGHT = 160

export function MessageComposer({
  placeholder,
  onSend,
  onTyping,
  sending,
  autoFocus,
  className,
}: MessageComposerProps) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingUpload[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
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

  const isUploading = pending.some((p) => p.status === 'uploading')
  const readyAttachments = pending.filter((p) => p.status === 'done' && p.attachment)
  const hasFailed = pending.some((p) => p.status === 'error')
  const canSend = !sending && !isUploading && (text.trim().length > 0 || readyAttachments.length > 0)

  const handleSend = () => {
    if (!canSend) return
    const attachments = readyAttachments.map((p) => p.attachment!)
    onSend(text.trim(), attachments)
    setText('')
    pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    setPending([])
    requestAnimationFrame(() => resizeTextarea(textareaRef.current))
  }

  return (
    <form
      className={cn('border-t border-border bg-card px-3 py-2.5', className)}
      onSubmit={(e) => {
        e.preventDefault()
        handleSend()
      }}
    >
      {pending.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                p.status === 'error'
                  ? 'border-destructive/40 bg-destructive/10'
                  : 'border-border bg-secondary/50',
              )}
            >
              {p.previewUrl ? (
                <img src={p.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
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
            setText(e.target.value)
            onTyping?.(e.target.value)
            resizeTextarea(e.target)
          }}
          onKeyDown={(e) => {
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
          Enter to send · Shift + Enter for a new line
        </p>
      )}
    </form>
  )
}
