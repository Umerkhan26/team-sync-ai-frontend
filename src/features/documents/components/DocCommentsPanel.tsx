import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/utils/cn'
import type { User } from '@/types'

export interface DocComment {
  id: string
  body: string
  createdAt: string
  author: string
}

function commentsKey(documentId: string) {
  return `ts_doc_comments_${documentId}`
}

export function loadDocComments(documentId: string): DocComment[] {
  try {
    const raw = localStorage.getItem(commentsKey(documentId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as DocComment[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDocComments(documentId: string, comments: DocComment[]) {
  localStorage.setItem(commentsKey(documentId), JSON.stringify(comments))
}

function renderCommentBody(body: string) {
  const parts = body.split(/(@[\w\s.-]+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="rounded bg-primary/15 px-0.5 font-medium text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

interface DocCommentsPanelProps {
  documentId: string
  currentUserName: string
  members: User[]
}

export function DocCommentsPanel({ documentId, currentUserName, members }: DocCommentsPanelProps) {
  const [comments, setComments] = useState<DocComment[]>(() => loadDocComments(documentId))
  const [draft, setDraft] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setComments(loadDocComments(documentId))
    setDraft('')
    setMentionQuery(null)
  }, [documentId])

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 6)
  }, [members, mentionQuery])

  const syncDraft = useCallback((value: string, cursor: number) => {
    setDraft(value)
    const before = value.slice(0, cursor)
    const atMatch = before.match(/@([\w\s.-]*)$/)
    setMentionQuery(atMatch ? atMatch[1]!.trim() || '' : null)
  }, [])

  const insertMention = (user: User) => {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart
    const before = draft.slice(0, cursor)
    const after = draft.slice(cursor)
    const atIndex = before.lastIndexOf('@')
    if (atIndex < 0) return
    const name = user.name || user.email.split('@')[0]!
    const next = `${before.slice(0, atIndex)}@${name} ${after}`
    setDraft(next)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      el.focus()
      const pos = atIndex + name.length + 2
      el.setSelectionRange(pos, pos)
    })
  }

  const addComment = () => {
    const body = draft.trim()
    if (!body) return
    const next: DocComment = {
      id: crypto.randomUUID(),
      body,
      createdAt: new Date().toISOString(),
      author: currentUserName,
    }
    const updated = [next, ...comments]
    setComments(updated)
    saveDocComments(documentId, updated)
    setDraft('')
    setMentionQuery(null)
  }

  return (
    <aside className="surface-panel flex h-fit flex-col p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-primary" />
        Comments
        <span className="text-xs font-normal text-muted-foreground">({comments.length})</span>
      </h3>

      <div className="relative mb-4 space-y-2">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => syncDraft(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              addComment()
            }
          }}
          placeholder="Add a comment… Use @ to mention"
          rows={3}
          className="resize-none text-sm"
        />
        {mentionCandidates.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {mentionCandidates.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(user)
                  }}
                >
                  <span className="font-medium">{user.name}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{user.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button size="sm" className="w-full gap-1.5" disabled={!draft.trim()} onClick={addComment}>
          <Send className="h-3.5 w-3.5" />
          Comment
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-md border border-border px-2.5 py-2 text-xs"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-medium">{comment.author}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatDateTime(comment.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{renderCommentBody(comment.body)}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
