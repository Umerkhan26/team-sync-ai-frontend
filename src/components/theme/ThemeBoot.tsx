import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setTheme } from '@/store/uiSlice'

/** Applies persisted theme to <html data-theme> on boot and keep in sync. */
export function ThemeBoot() {
  const theme = useAppSelector((s) => s.ui.theme)
  const dispatch = useAppDispatch()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const stored = localStorage.getItem('teamsync_theme')
    if (stored === 'light' || stored === 'dark') {
      dispatch(setTheme(stored))
    }
  }, [dispatch])

  return null
}
