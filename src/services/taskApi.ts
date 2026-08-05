import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { Task, TaskCustomField, TaskPriority, TaskStatus } from '@/types'

export const taskApi = {
  list(params?: {
    page?: number
    limit?: number
    projectId?: string
    status?: TaskStatus
    assigneeId?: string
  }) {
    return apiGet<{ items: Task[] }>('/tasks', params)
  },
  get(taskId: string) {
    return apiGet<{ task: Task }>(`/tasks/${taskId}`).then((r) => r.data.task)
  },
  create(input: {
    projectId: string
    title: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    assigneeIds?: string[]
    dueDate?: string | null
    labels?: string[]
    customFields?: TaskCustomField[]
    parentTaskId?: string | null
    blockedByTaskIds?: string[]
  }) {
    return apiPost<{ task: Task }>('/tasks', input)
  },
  update(
    taskId: string,
    input: Partial<{
      title: string
      description: string
      priority: TaskPriority
      assigneeIds: string[]
      dueDate: string | null
      labels: string[]
      customFields: TaskCustomField[]
      parentTaskId: string | null
      blockedByTaskIds: string[]
    }>,
  ) {
    return apiPatch<{ task: Task }>(`/tasks/${taskId}`, input)
  },
  listSubtasks(taskId: string) {
    return apiGet<{ items: Task[] }>(`/tasks/${taskId}/subtasks`).then((r) => r.data.items)
  },
  transition(taskId: string, status: TaskStatus) {
    return apiPost<{ task: Task }>(`/tasks/${taskId}/transition`, { status })
  },
  remove(taskId: string) {
    return apiDelete<{ deleted: boolean }>(`/tasks/${taskId}`)
  },
  listComments(taskId: string) {
    return apiGet<{ items: Array<{ id: string; body: string; createdAt?: string }> }>(
      `/tasks/${taskId}/comments`,
    ).then((r) => r.data.items)
  },
  addComment(taskId: string, body: string) {
    return apiPost<{ comment: unknown }>(`/tasks/${taskId}/comments`, { body })
  },
  listActivities(taskId: string) {
    return apiGet<{ items: Array<{ id: string; type: string; createdAt?: string }> }>(
      `/tasks/${taskId}/activities`,
    ).then((r) => r.data.items)
  },
}
