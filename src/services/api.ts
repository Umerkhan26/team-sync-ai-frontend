import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { ApiSuccess } from '@/types'
import { store } from '@/store'
import { logout, setTokens } from '@/store/authSlice'
import { clearActiveOrganization } from '@/store/orgSlice'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = store.getState().auth.refreshToken
  try {
    const { data } = await axios.post<
      ApiSuccess<{ accessToken: string; refreshToken: string }>
    >(
      `${API_URL}/auth/refresh`,
      refreshToken ? { refreshToken } : {},
      { withCredentials: true },
    )
    store.dispatch(
      setTokens({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
      }),
    )
    return data.data.accessToken
  } catch {
    store.dispatch(logout())
    store.dispatch(clearActiveOrganization())
    return null
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const state = store.getState()
  const token = state.auth.accessToken
  const orgId = state.org.activeOrganization?.id

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (orgId) {
    config.headers['X-Organization-Id'] = orgId
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }
    const status = error.response?.status
    const url = original?.url || ''

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/refresh')
    ) {
      original._retry = true
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newToken = await refreshPromise
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
    }

    return Promise.reject(error)
  },
)

export function unwrapData<T>(payload: ApiSuccess<T>): T {
  return payload.data
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await api.get<ApiSuccess<T>>(url, { params })
  return { data: unwrapData(data), meta: data.meta }
}

export async function apiPost<T>(url: string, body?: unknown) {
  const { data } = await api.post<ApiSuccess<T>>(url, body)
  return unwrapData(data)
}

export async function apiPatch<T>(url: string, body?: unknown) {
  const { data } = await api.patch<ApiSuccess<T>>(url, body)
  return unwrapData(data)
}

export async function apiDelete<T>(url: string) {
  const { data } = await api.delete<ApiSuccess<T>>(url)
  return unwrapData(data)
}
