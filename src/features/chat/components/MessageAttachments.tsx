import { useState } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { MessageAttachment } from '@/types'

function isImageAttachment(mimeType: string) {
  return mimeType.startsWith('image/')
}

function downloadAttachment(attachment: MessageAttachment) {
  const link = document.createElement('a')
  link.href = attachment.url
  link.download = attachment.fileName
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

interface MessageAttachmentsProps {
  attachments: MessageAttachment[]
  className?: string
}

export function MessageAttachments({ attachments, className }: MessageAttachmentsProps) {
  const [preview, setPreview] = useState<MessageAttachment | null>(null)

  if (!attachments || attachments.length === 0) return null

  const images = attachments.filter((a) => isImageAttachment(a.mimeType))
  const files = attachments.filter((a) => !isImageAttachment(a.mimeType))

  return (
    <div className={cn('mt-1.5 flex flex-wrap gap-2', className)}>
      {images.map((attachment, index) => (
        <div
          key={`${attachment.url}-${index}`}
          className="group/att relative overflow-hidden rounded-lg border border-border bg-muted"
        >
          <button type="button" onClick={() => setPreview(attachment)} className="block">
            <img
              src={attachment.url}
              alt={attachment.fileName}
              className="max-h-52 max-w-[min(20rem,80vw)] object-cover"
              loading="lazy"
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadAttachment(attachment)
            }}
            className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1.5 text-white opacity-0 shadow-sm transition group-hover/att:opacity-100 hover:bg-black/75"
            aria-label={`Download ${attachment.fileName}`}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {files.map((attachment, index) => (
        <div
          key={`${attachment.url}-file-${index}`}
          className="flex max-w-xs items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-2 text-xs"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 truncate font-medium text-foreground" title={attachment.fileName}>
            {attachment.fileName}
          </span>
          <button
            type="button"
            onClick={() => downloadAttachment(attachment)}
            className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={`Download ${attachment.fileName}`}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {preview ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute right-5 top-5 flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                downloadAttachment(preview)
              }}
              className="rounded-md bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label={`Download ${preview.fileName}`}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-md bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <img
            src={preview.url}
            alt={preview.fileName}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  )
}
