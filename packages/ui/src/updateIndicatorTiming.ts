import type { UpdateStatus } from './UpdateIndicator.types'

/** How long a change of update state takes to cross-fade. */
export const UPDATE_FADE_MS = 200

/** How small a glyph is at either end of the fade. */
export const UPDATE_FADE_SCALE = 0.6

/** What makes a new layer: the state. Not the progress, which redraws the ring in place. */
export function updateLayerKey(status: UpdateStatus): string {
  return status.kind
}

/**
 * The two changes drawn as the ring turning into the next state rather than as a cross-fade: the
 * available ring's dots joining into the download's track, and the finished download's ring
 * filling inward into the ready disc. Every other change cross-fades.
 */
export type UpdateMorph = 'join' | 'fill'

export function morphBetween(
  from: UpdateStatus['kind'],
  to: UpdateStatus['kind'],
): UpdateMorph | null {
  if (from === 'available' && to === 'downloading') return 'join'
  if (from === 'downloading' && to === 'ready') return 'fill'
  return null
}

/** The ring's change, during which the old glyph shrinks away. */
export const MORPH_RING_MS = 380
/** The new glyph popping in once the ring has changed. */
const MORPH_POP_MS = 360
export const MORPH_MS = MORPH_RING_MS + MORPH_POP_MS

/** How much of the ring's change the old glyph takes to shrink to nothing. */
const SHRINK_SHARE = 0.7
/** How far past full size the new glyph pops before settling. */
const POP_OVERSHOOT = 1.15

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export interface MorphFrame {
  /** How far the ring has changed, eased, 0 to 1. */
  ring: number
  /** The old glyph's scale, 1 down to 0. */
  outgoing: number
  /** The new glyph's scale: 0 until the ring has finished, then past 1 and back. */
  incoming: number
}

/** Where a morph has got to after `elapsedMs`. */
export function morphFrame(elapsedMs: number): MorphFrame {
  const ring = clamp01(elapsedMs / MORPH_RING_MS)
  const pop = clamp01((elapsedMs - MORPH_RING_MS) / MORPH_POP_MS)
  return {
    ring: easeOut(ring),
    outgoing: 1 - easeOut(clamp01(ring / SHRINK_SHARE)),
    incoming:
      pop === 0
        ? 0
        : pop < 0.6
          ? POP_OVERSHOOT * easeOut(pop / 0.6)
          : POP_OVERSHOOT - (POP_OVERSHOOT - 1) * easeOut((pop - 0.6) / 0.4),
  }
}
