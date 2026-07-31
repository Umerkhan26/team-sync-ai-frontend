import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types'

const ACCESS_KEY = 'teamsync_access_token'
const REFRESH_KEY = 'teamsync_refresh_token'
const USER_KEY = 'teamsync_user'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  initialized: boolean
}

const initialState: AuthState = {
  user: readJson<User>(USER_KEY),
  accessToken: localStorage.getItem(ACCESS_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  initialized: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        user: User
        accessToken: string
        refreshToken: string
      }>,
    ) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      localStorage.setItem(ACCESS_KEY, action.payload.accessToken)
      localStorage.setItem(REFRESH_KEY, action.payload.refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload))
    },
    setTokens(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>,
    ) {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      localStorage.setItem(ACCESS_KEY, action.payload.accessToken)
      localStorage.setItem(REFRESH_KEY, action.payload.refreshToken)
    },
    setInitialized(state, action: PayloadAction<boolean>) {
      state.initialized = action.payload
    },
    logout(state) {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})

export const { setCredentials, setUser, setTokens, setInitialized, logout } =
  authSlice.actions
export default authSlice.reducer

export const authStorageKeys = { ACCESS_KEY, REFRESH_KEY, USER_KEY }
