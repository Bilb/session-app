import { useEffect, useState } from 'react'

import type { UpdateStatus } from './UpdateIndicator.types'
import { MORPH_MS, morphBetween, type UpdateMorph } from './updateIndicatorTiming'

export interface ActiveMorph {
  morph: UpdateMorph
  elapsedMs: number
}

/**
 * The morph running between the last state and this one, or null while none is.
 *
 * Driven by animation frames rather than a native animation, so the one drawing in `UpdateGlyph`
 * serves both platforms: the ring's geometry changes, which no transform can express, and it is a
 * 28 px drawing for under a second.
 */
export function useUpdateMorph(kind: UpdateStatus['kind'], instant: boolean): ActiveMorph | null {
  // The change is noticed during render, so the frame that commits the new state already draws the
  // morph's first frame rather than one of the new state that the morph then replaces.
  const [run, setRun] = useState<{
    kind: UpdateStatus['kind']
    morph: UpdateMorph | null
    id: number
  }>({ kind, morph: null, id: 0 })
  if (run.kind !== kind)
    setRun({ kind, morph: instant ? null : morphBetween(run.kind, kind), id: run.id + 1 })

  const [elapsed, setElapsed] = useState({ id: 0, ms: 0 })
  useEffect(() => {
    if (run.morph === null) return
    const started = Date.now()
    let frame = 0
    const tick = () => {
      const ms = Date.now() - started
      setElapsed({ id: run.id, ms })
      if (ms < MORPH_MS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [run])

  if (run.morph === null) return null
  const ms = elapsed.id === run.id ? elapsed.ms : 0
  return ms >= MORPH_MS ? null : { morph: run.morph, elapsedMs: ms }
}
