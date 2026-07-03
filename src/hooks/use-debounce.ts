'use client'

import { useEffect, useState } from 'react'

/**
 * Debounce a callback.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(callback: T, delay: number) {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [timer])

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    const t = setTimeout(() => callback(...args), delay)
    setTimer(t)
  }
}

/**
 * Debounce a value (returns debounced value).
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
