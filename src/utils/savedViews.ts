export type SavedViewScope = 'tasks' | 'files'

export interface SavedView {
  id: string
  name: string
  createdAt?: string
  filters: Record<string, string>
  scope?: SavedViewScope
}
