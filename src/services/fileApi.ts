import { api, apiDelete, apiGet, apiPost } from './api'
import type { AiGenerateResult, AnalyticsOverview, FileAsset, FileVersionEntry } from '@/types'

export const aiApi = {
  generate(input: {
    prompt: string
    systemInstruction?: string
    feature?: string
  }) {
    return apiPost<{ result: AiGenerateResult }>('/ai/generate', input)
  },
  suggestActions() {
    return apiPost<{ result: AiGenerateResult }>('/ai/suggest-actions')
  },
}

export const analyticsApi = {
  overview() {
    return apiGet<{ overview: AnalyticsOverview }>('/analytics/overview').then(
      (r) => r.data.overview,
    )
  },
}

export const fileApi = {
  async upload(
    file: File,
    meta?: { projectId?: string; taskId?: string; onProgress?: (percent: number) => void },
  ) {
    const form = new FormData()
    form.append('file', file)
    if (meta?.projectId) form.append('projectId', meta.projectId)
    if (meta?.taskId) form.append('taskId', meta.taskId)
    const { data } = await api.post<{ success: true; data: { file: FileAsset } }>(
      '/files',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: meta?.onProgress
          ? (event) => {
              const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0
              meta.onProgress?.(percent)
            }
          : undefined,
      },
    )
    return data.data.file
  },
  list(params?: { page?: number; limit?: number; projectId?: string }) {
    return apiGet<{ items: FileAsset[] }>('/files', params)
  },
  get(fileId: string) {
    return apiGet<{ file: FileAsset }>(`/files/${fileId}`).then((r) => r.data.file)
  },
  listVersions(fileId: string) {
    return apiGet<{ file: FileAsset; versions: FileVersionEntry[] }>(
      `/files/${fileId}/versions`,
    ).then((r) => r.data)
  },
  async uploadVersion(
    fileId: string,
    file: File,
    meta?: { onProgress?: (percent: number) => void },
  ) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post<{ success: true; data: { file: FileAsset } }>(
      `/files/${fileId}/versions`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: meta?.onProgress
          ? (event) => {
              const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0
              meta.onProgress?.(percent)
            }
          : undefined,
      },
    )
    return data.data.file
  },
  restoreVersion(fileId: string, versionId: string) {
    return apiPost<{ file: FileAsset }>(`/files/${fileId}/versions/${versionId}/restore`).then(
      (r) => r.file,
    )
  },
  remove(fileId: string) {
    return apiDelete<{ deleted: boolean }>(`/files/${fileId}`)
  },
}
