import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type ThemeMode = 'light' | 'dark'

interface UiState {
  sidebarOpen: boolean
  mobileNavOpen: boolean
  theme: ThemeMode
  commandOpen: boolean
  aiPanelOpen: boolean
  notificationsOpen: boolean
  activeTaskId: string | null
}

const THEME_KEY = 'teamsync_theme'

function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    // ignore
  }
  return 'light'
}

const initialState: UiState = {
  sidebarOpen: true,
  mobileNavOpen: false,
  theme: typeof window !== 'undefined' ? readTheme() : 'light',
  commandOpen: false,
  aiPanelOpen: false,
  notificationsOpen: false,
  activeTaskId: null,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    setMobileNavOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavOpen = action.payload
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload
      localStorage.setItem(THEME_KEY, action.payload)
      document.documentElement.setAttribute('data-theme', action.payload)
    },
    toggleTheme(state) {
      const next = state.theme === 'light' ? 'dark' : 'light'
      state.theme = next
      localStorage.setItem(THEME_KEY, next)
      document.documentElement.setAttribute('data-theme', next)
    },
    setCommandOpen(state, action: PayloadAction<boolean>) {
      state.commandOpen = action.payload
    },
    setAiPanelOpen(state, action: PayloadAction<boolean>) {
      state.aiPanelOpen = action.payload
    },
    toggleAiPanel(state) {
      state.aiPanelOpen = !state.aiPanelOpen
    },
    setNotificationsOpen(state, action: PayloadAction<boolean>) {
      state.notificationsOpen = action.payload
    },
    setActiveTaskId(state, action: PayloadAction<string | null>) {
      state.activeTaskId = action.payload
    },
  },
})

export const {
  setSidebarOpen,
  toggleSidebar,
  setMobileNavOpen,
  setTheme,
  toggleTheme,
  setCommandOpen,
  setAiPanelOpen,
  toggleAiPanel,
  setNotificationsOpen,
  setActiveTaskId,
} = uiSlice.actions

export default uiSlice.reducer
