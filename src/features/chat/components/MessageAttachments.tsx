import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-react'
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

const GRID_VISIBLE = 4

export function MessageAttachments({ attachments, className }: MessageAttachmentsProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const images = useMemo(
    () => (attachments || []).filter((a) => isImageAttachment(a.mimeType)),
    [attachments],
  )
  const files = useMemo(
    () => (attachments || []).filter((a) => !isImageAttachment(a.mimeType)),
    [attachments],
  )

  useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowRight' && images.length > 1) {
        setLightboxIndex((i) => (i == null ? 0 : (i + 1) % images.length))
      }
      if (e.key === 'ArrowLeft' && images.length > 1) {
        setLightboxIndex((i) => (i == null ? 0 : (i - 1 + images.length) % images.length))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, images.length])

  if (!attachments || attachments.length === 0) return null

  const visible = images.slice(0, GRID_VISIBLE)
  const overflow = Math.max(0, images.length - GRID_VISIBLE)
  const active = lightboxIndex != null ? images[lightboxIndex] : null

  return (
    <div className={cn('mt-1.5 space-y-2', className)}>
      {images.length > 0 ? (
        <div
          className={cn(
            'grid max-w-md gap-1',
            images.length === 1 && 'grid-cols-1',
            images.length === 2 && 'grid-cols-2',
            images.length >= 3 && 'grid-cols-2',
          )}
        >
          {visible.map((attachment, index) => {
            const isLastVisible = index === visible.length - 1 && overflow > 0
            const tall = images.length === 1
            return (
              <button
                key={`${attachment.url}-${index}`}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className={cn(
                  'group/att relative overflow-hidden rounded-lg border border-border bg-muted text-left',
                  tall ? 'max-h-64' : 'aspect-square',
                  images.length === 3 && index === 0 && 'row-span-2 aspect-auto min-h-full',
                )}
              >
                <img
                  src={attachment.url}
                  alt={attachment.fileName}
                  className={cn('h-full w-full object-cover', tall && 'max-h-64 w-full')}
                  loading="lazy"
                />
                {isLastVisible ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                    +{overflow}
                  </span>
                ) : null}
                <span
                  role="button"
                  tabIndex={0}
                  className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1.5 text-white opacity-0 transition group-hover/att:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadAttachment(attachment)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      downloadAttachment(attachment)
                    }
                  }}
                  aria-label={`Download ${attachment.fileName}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
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
        </div>
      ) : null}

      {active ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="absolute right-5 top-5 flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                downloadAttachment(active)
              }}
              className="rounded-md bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label={`Download ${active.fileName}`}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="rounded-md bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex((i) => (i == null ? 0 : (i - 1 + images.length) % images.length))
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 sm:right-16"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex((i) => (i == null ? 0 : (i + 1) % images.length))
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          <div
            className="flex max-h-[85vh] max-w-[90vw] flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={active.url}
              alt={active.fileName}
              className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            <p className="text-xs text-white/80">
              {active.fileName}
              {images.length > 1 && lightboxIndex != null
                ? ` · ${lightboxIndex + 1} / ${images.length}`
                : ''}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
