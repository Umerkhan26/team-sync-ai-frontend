import { apiDelete, apiGet, apiPost } from './api'
import type { SavedView, SavedViewScope } from '@/utils/savedViews'

export const savedViewApi = {
  list(scope: SavedViewScope) {
    return apiGet<{ items: SavedView[] }>('/saved-views', { scope }).then((r) => r.data.items)
  },
  create(input: { scope: SavedViewScope; name: string; filters: Record<string, string> }) {
    return apiPost<{ view: SavedView }>('/saved-views', input).then((r) => r.view)
  },
  remove(viewId: string) {
    return apiDelete<{ deleted: boolean }>(`/saved-views/${viewId}`)
  },
}
