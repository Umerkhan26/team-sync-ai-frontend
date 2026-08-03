import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type {
  Channel,
  ChannelUnreadSummary,
  Message,
  MessageBookmarkEntry,
  MessagePinEntry,
} from '@/types'

export const channelApi = {
  list(params?: { page?: number; limit?: number; projectId?: string }) {
    return apiGet<{ items: Channel[] }>('/channels', params)
  },
  get(channelId: string) {
    return apiGet<{ channel: Channel }>(`/channels/${channelId}`).then(
      (r) => r.data.channel,
    )
  },
  create(input: {
    name: string
    description?: string
    type?: 'public' | 'private' | 'direct'
    projectId?: string | null
    memberIds?: string[]
  }) {
    return apiPost<{ channel: Channel }>('/channels', input)
  },
  createDm(userId: string) {
    return apiPost<{ channel: Channel }>('/channels/dm', { userId })
  },
  update(
    channelId: string,
    input: Partial<{
      name: string
      description: string
      memberIds: string[]
      type: 'public' | 'private'
      projectId: string | null
    }>,
  ) {
    return apiPatch<{ channel: Channel }>(`/channels/${channelId}`, input)
  },
  addMembers(channelId: string, memberIds: string[]) {
    return apiPost<{ channel: Channel }>(`/channels/${channelId}/members`, { memberIds })
  },
  remove(channelId: string) {
    return apiDelete<{ deleted: boolean }>(`/channels/${channelId}`)
  },
  listMessages(
    channelId: string,
    params?: { page?: number; limit?: number; parentMessageId?: string | null },
  ) {
    return apiGet<{ items: Message[] }>(`/channels/${channelId}/messages`, params)
  },
  sendMessage(
    channelId: string,
    body: string,
    parentMessageId?: string | null,
    attachments?: Array<{
      url: string
      fileName: string
      mimeType: string
      fileAssetId?: string
    }>,
  ) {
    return apiPost<{ message: Message }>(`/channels/${channelId}/messages`, {
      body,
      parentMessageId: parentMessageId || undefined,
      attachments,
    })
  },
  updateMessage(channelId: string, messageId: string, body: string) {
    return apiPatch<{ message: Message }>(
      `/channels/${channelId}/messages/${messageId}`,
      { body },
    )
  },
  deleteMessage(channelId: string, messageId: string) {
    return apiDelete<{ deleted: boolean }>(
      `/channels/${channelId}/messages/${messageId}`,
    )
  },
  toggleReaction(channelId: string, messageId: string, emoji: string) {
    return apiPost<{ message: Message }>(
      `/channels/${channelId}/messages/${messageId}/reactions`,
      { emoji },
    )
  },
  listPins(channelId: string) {
    return apiGet<{ items: MessagePinEntry[] }>(`/channels/${channelId}/pins`).then(
      (r) => r.data.items,
    )
  },
  pinMessage(channelId: string, messageId: string) {
    return apiPost<{ pin: MessagePinEntry }>(`/channels/${channelId}/messages/${messageId}/pin`)
  },
  unpinMessage(channelId: string, messageId: string) {
    return apiDelete<{ deleted: boolean }>(
      `/channels/${channelId}/messages/${messageId}/pin`,
    )
  },
  listBookmarks() {
    return apiGet<{ items: MessageBookmarkEntry[] }>('/channels/bookmarks').then(
      (r) => r.data.items,
    )
  },
  addBookmark(channelId: string, messageId: string) {
    return apiPost<{ bookmark: MessageBookmarkEntry }>('/channels/bookmarks', {
      channelId,
      messageId,
    })
  },
  removeBookmark(bookmarkId: string) {
    return apiDelete<{ deleted: boolean }>(`/channels/bookmarks/${bookmarkId}`)
  },
  markRead(channelId: string, lastReadAt?: string) {
    return apiPost<{ state: { lastReadAt: string } }>(`/channels/${channelId}/read`, {
      lastReadAt,
    })
  },
  unreadSummary() {
    return apiGet<ChannelUnreadSummary>('/channels/unread-summary').then((r) => r.data)
  },
}
