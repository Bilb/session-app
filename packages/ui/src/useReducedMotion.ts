import { useEffect, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** The system's reduced-motion setting, followed while mounted. False where nothing can say. */
export function useReducedMotion(): boolean {
  const [query] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null,
  )
  const [reduced, setReduced] = useState(query?.matches ?? false)
  useEffect(() => {
    if (query === null) return
    const follow = (event: MediaQueryListEvent) => {
      setReduced(event.matches)
    }
    query.addEventListener('change', follow)
    return () => {
      query.removeEventListener('change', follow)
    }
  }, [query])
  return reduced
}
