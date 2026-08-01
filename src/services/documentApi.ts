import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { DocumentComment, DocumentItem, DocumentVersion } from '@/types'

export const documentApi = {
  list(params?: { page?: number; limit?: number; projectId?: string; q?: string }) {
    return apiGet<{ items: DocumentItem[] }>('/documents', params)
  },
  get(documentId: string) {
    return apiGet<{ document: DocumentItem }>(`/documents/${documentId}`).then(
      (r) => r.data.document,
    )
  },
  create(input: {
    title: string
    content?: string
    contentJson?: Record<string, unknown>
    projectId?: string | null
    tags?: string[]
  }) {
    return apiPost<{ document: DocumentItem }>('/documents', input)
  },
  update(
    documentId: string,
    input: Partial<{
      title: string
      content: string
      contentJson: Record<string, unknown>
      projectId: string | null
      tags: string[]
    }>,
  ) {
    return apiPatch<{ document: DocumentItem }>(`/documents/${documentId}`, input)
  },
  remove(documentId: string) {
    return apiDelete<{ deleted: boolean }>(`/documents/${documentId}`)
  },
  listVersions(documentId: string) {
    return apiGet<{ items: DocumentVersion[] }>(
      `/documents/${documentId}/versions`,
    ).then((r) => r.data.items)
  },
  restoreVersion(documentId: string, versionId: string) {
    return apiPost<{ document: DocumentItem }>(
      `/documents/${documentId}/versions/${versionId}/restore`,
    )
  },
  listComments(documentId: string) {
    return apiGet<{ items: DocumentComment[] }>(`/documents/${documentId}/comments`).then(
      (r) => r.data.items,
    )
  },
  addComment(
    documentId: string,
    body: string,
    options?: { mentionIds?: string[]; parentCommentId?: string | null },
  ) {
    return apiPost<{ comment: DocumentComment }>(`/documents/${documentId}/comments`, {
      body,
      mentionIds: options?.mentionIds,
      parentCommentId: options?.parentCommentId,
    })
  },
  removeComment(documentId: string, commentId: string) {
    return apiDelete<{ deleted: boolean }>(
      `/documents/${documentId}/comments/${commentId}`,
    )
  },
}
