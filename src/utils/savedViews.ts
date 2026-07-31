export type SavedViewScope = 'tasks' | 'files'

export interface SavedView {
  id: string
  name: string
  createdAt: string
  filters: Record<string, string>
}

function storageKey(orgId: string, scope: SavedViewScope) {
  return `teamsync_saved_views_${orgId}_${scope}`
}

export function listSavedViews(orgId: string, scope: SavedViewScope): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(orgId, scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedView[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSavedView(
  orgId: string,
  scope: SavedViewScope,
  name: string,
  filters: Record<string, string>,
): SavedView[] {
  const views = listSavedViews(orgId, scope)
  const next: SavedView = {
    id: `${Date.now()}`,
    name: name.trim() || 'Untitled view',
    createdAt: new Date().toISOString(),
    filters,
  }
  const updated = [next, ...views].slice(0, 12)
  localStorage.setItem(storageKey(orgId, scope), JSON.stringify(updated))
  return updated
}

export function deleteSavedView(orgId: string, scope: SavedViewScope, id: string): SavedView[] {
  const updated = listSavedViews(orgId, scope).filter((v) => v.id !== id)
  localStorage.setItem(storageKey(orgId, scope), JSON.stringify(updated))
  return updated
}
