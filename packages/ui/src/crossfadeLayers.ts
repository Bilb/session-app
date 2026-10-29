import { useEffect, useRef, useState } from 'react'

/** One state drawn by a cross-fade: the one arriving, or one still fading out. */
export interface CrossfadeLayer<T> {
  /** Unique among the layers on screen, for React. */
  id: string
  value: T
  leaving: boolean
}

/**
 * The layers a cross-fade draws for `value`: the current one, and any that are still fading out.
 *
 * A new layer starts only when `key` changes, so a value that updates in place -- a download's
 * progress -- redraws the current layer rather than fading into a copy of itself. A departing layer
 * is dropped once `durationMs` has passed, which is when its fade has finished.
 */
export function useCrossfadeLayers<T>(
  key: string,
  value: T,
  durationMs: number,
  instant: boolean,
): CrossfadeLayer<T>[] {
  const [leaving, setLeaving] = useState<CrossfadeLayer<T>[]>([])
  const last = useRef({ key, value })
  const departures = useRef(0)
  // Kept apart from the effect below, which runs on every render: a timer cleared there would be
  // cleared by the next progress update, and its layer never dropped.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const previous = last.current
    last.current = { key, value }
    if (previous.key === key || instant) return
    departures.current += 1
    const id = `${previous.key}:${String(departures.current)}`
    setLeaving((layers) => [...layers, { id, value: previous.value, leaving: true }])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setLeaving((layers) => layers.filter((layer) => layer.id !== id))
    }, durationMs)
    timers.current.add(timer)
  })

  return [...leaving, { id: key, value, leaving: false }]
}
