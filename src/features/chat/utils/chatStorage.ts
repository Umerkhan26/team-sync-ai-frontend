import type { Message } from '@/types'

export interface PinnedEntry {
  messageId: string
  pinnedAt: string
  body?: string
  authorName?: string
  createdAt?: string
}

export interface BookmarkEntry {
  id: string
  messageId: string
  channelId: string
  channelLabel: string
  body: string
  authorName?: string
  messageCreatedAt?: string
  savedAt: string
}

function pinnedKey(channelId: string) {
  return `ts-pinned-msgs-${channelId}`
}

function bookmarksKey(orgId: string) {
  return `ts-bookmarks-${orgId}`
}

function lastReadKey(channelId: string) {
  return `lastRead_${channelId}`
}

function unreadKey(channelId: string) {
  return `ts-unread-${channelId}`
}

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function listPinned(channelId: string): PinnedEntry[] {
  return readJson<PinnedEntry[]>(localStorage.getItem(pinnedKey(channelId)), [])
}

export function pinMessage(
  channelId: string,
  message: Message,
  authorName?: string,
): PinnedEntry[] {
  const current = listPinned(channelId)
  if (current.some((p) => p.messageId === message.id)) return current
  const entry: PinnedEntry = {
    messageId: message.id,
    pinnedAt: new Date().toISOString(),
    body: message.body,
    authorName,
    createdAt: message.createdAt,
  }
  const updated = [...current, entry]
  localStorage.setItem(pinnedKey(channelId), JSON.stringify(updated))
  return updated
}

export function unpinMessage(channelId: string, messageId: string): PinnedEntry[] {
  const updated = listPinned(channelId).filter((p) => p.messageId !== messageId)
  localStorage.setItem(pinnedKey(channelId), JSON.stringify(updated))
  return updated
}

export function isPinned(channelId: string, messageId: string): boolean {
  return listPinned(channelId).some((p) => p.messageId === messageId)
}

export function listBookmarks(orgId: string): BookmarkEntry[] {
  return readJson<BookmarkEntry[]>(localStorage.getItem(bookmarksKey(orgId)), [])
}

export function addBookmark(
  orgId: string,
  input: Omit<BookmarkEntry, 'id' | 'savedAt'>,
): BookmarkEntry[] {
  const current = listBookmarks(orgId)
  if (current.some((b) => b.messageId === input.messageId && b.channelId === input.channelId)) {
    return current
  }
  const entry: BookmarkEntry = {
    ...input,
    id: `${Date.now()}-${input.messageId}`,
    savedAt: new Date().toISOString(),
  }
  const updated = [entry, ...current].slice(0, 100)
  localStorage.setItem(bookmarksKey(orgId), JSON.stringify(updated))
  return updated
}

export function removeBookmark(orgId: string, id: string): BookmarkEntry[] {
  const updated = listBookmarks(orgId).filter((b) => b.id !== id)
  localStorage.setItem(bookmarksKey(orgId), JSON.stringify(updated))
  return updated
}

export function isBookmarked(orgId: string, messageId: string, channelId: string): boolean {
  return listBookmarks(orgId).some((b) => b.messageId === messageId && b.channelId === channelId)
}

export function getLastRead(channelId: string): string | null {
  return localStorage.getItem(lastReadKey(channelId))
}

export function setLastRead(channelId: string, timestamp: string): void {
  localStorage.setItem(lastReadKey(channelId), timestamp)
}

export function getUnreadCount(channelId: string): number {
  const raw = localStorage.getItem(unreadKey(channelId))
  if (!raw) return 0
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function setUnreadCount(channelId: string, count: number): void {
  if (count <= 0) {
    localStorage.removeItem(unreadKey(channelId))
  } else {
    localStorage.setItem(unreadKey(channelId), String(count))
  }
}

export function incrementUnread(channelId: string): number {
  const next = getUnreadCount(channelId) + 1
  setUnreadCount(channelId, next)
  return next
}

export function clearUnread(channelId: string): void {
  setUnreadCount(channelId, 0)
}

/** Mark channel read using the latest message timestamp (or now if none). */
export function markChannelRead(channelId: string, messages: Message[]): void {
  clearUnread(channelId)
  let latest = Date.now()
  for (const m of messages) {
    if (!m.createdAt) continue
    const t = new Date(m.createdAt).getTime()
    if (t > latest) latest = t
  }
  setLastRead(channelId, new Date(latest).toISOString())
}

export function shouldCountAsUnread(channelId: string, createdAt?: string): boolean {
  if (!createdAt) return true
  const lastRead = getLastRead(channelId)
  if (!lastRead) return true
  return new Date(createdAt).getTime() > new Date(lastRead).getTime()
}
