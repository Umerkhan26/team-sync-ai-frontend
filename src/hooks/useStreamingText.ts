import { useEffect, useRef, useState } from 'react'

/** Simulates progressive token reveal when real streaming is unavailable. */
export function useStreamingText(fullText: string, active: boolean) {
  const [displayed, setDisplayed] = useState('')
  const prevRef = useRef('')

  useEffect(() => {
    if (!active || !fullText) {
      setDisplayed(fullText)
      prevRef.current = fullText
      return
    }

    if (fullText === prevRef.current) return
    prevRef.current = fullText

    setDisplayed('')
    let index = 0
    const tick = () => {
      index += Math.floor(Math.random() * 4) + 2
      if (index >= fullText.length) {
        setDisplayed(fullText)
        return
      }
      setDisplayed(fullText.slice(0, index))
    }

    const interval = window.setInterval(tick, 18)
    return () => window.clearInterval(interval)
  }, [fullText, active])

  return displayed
}
