import type { User } from '@/types'

const OBJECT_ID_RE = /^[a-f\d]{24}$/i

export type MentionUser = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>

/** Insert `@userId` (backend-stable) for mention notifications. */
export function mentionToken(userId: string) {
  return `@${userId}`
}

export function filterMentionCandidates(
  users: MentionUser[],
  query: string,
  excludeUserId?: string,
): MentionUser[] {
  const q = query.trim().toLowerCase()
  return users
    .filter((u) => u.id && u.id !== excludeUserId)
    .filter((u) => {
      if (!q) return true
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return name.includes(q) || email.includes(q) || name.split(/\s+/)[0]?.startsWith(q)
    })
    .slice(0, 8)
}

/**
 * Detect `@` mention query at caret: returns start index + query text, or null.
 */
export function getMentionQueryAtCaret(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const match = before.match(/(^|[\s([{])@([\w.-]*)$/)
  if (!match || match.index == null) return null
  const atIndex = match.index + match[1].length
  return { start: atIndex, query: match[2] || '' }
}

export function applyMentionReplacement(
  text: string,
  start: number,
  caret: number,
  userId: string,
): { next: string; nextCaret: number } {
  const token = `${mentionToken(userId)} `
  const next = text.slice(0, start) + token + text.slice(caret)
  return { next, nextCaret: start + token.length }
}

/** Split body into plain / mention segments for display. */
export function splitMessageBody(
  body: string,
  usersById: Map<string, MentionUser>,
): Array<{ type: 'text' | 'mention'; value: string; userId?: string; label?: string }> {
  if (!body) return []
  const parts: Array<{ type: 'text' | 'mention'; value: string; userId?: string; label?: string }> = []
  const re = /@([a-f\d]{24})\b/gi
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(body))) {
    if (match.index > last) {
      parts.push({ type: 'text', value: body.slice(last, match.index) })
    }
    const userId = match[1]
    const user = usersById.get(userId)
    const label = user?.name || user?.email || 'member'
    parts.push({ type: 'mention', value: match[0], userId, label })
    last = match.index + match[0].length
  }
  if (last < body.length) {
    parts.push({ type: 'text', value: body.slice(last) })
  }
  // Also highlight @Name style (no object id) lightly — keep as text with @ prefix look
  if (parts.length === 1 && parts[0]?.type === 'text' && !OBJECT_ID_RE.test('')) {
    return parts
  }
  return parts.length ? parts : [{ type: 'text', value: body }]
}
