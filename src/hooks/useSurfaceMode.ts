import { useEffect } from 'react'

/** Sets body surface class for marketing vs dense in-app product UI. */
export function useSurfaceMode(mode: 'marketing' | 'app') {
  useEffect(() => {
    document.body.classList.remove('surface-marketing', 'surface-app')
    document.body.classList.add(mode === 'app' ? 'surface-app' : 'surface-marketing')
    return () => {
      document.body.classList.remove('surface-marketing', 'surface-app')
    }
  }, [mode])
}
