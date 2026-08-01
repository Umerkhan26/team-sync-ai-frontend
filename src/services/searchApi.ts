import { apiGet } from './api'
import type { SearchResults } from '@/types'

export const searchApi = {
  search(q: string, limit = 8) {
    return apiGet<SearchResults>('/search', { q, limit }).then((r) => r.data)
  },
}
