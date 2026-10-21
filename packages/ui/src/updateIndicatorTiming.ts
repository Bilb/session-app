import type { UpdateStatus } from './UpdateIndicator.types'

/** How long a change of update state takes to cross-fade. */
export const UPDATE_FADE_MS = 200

/** How small a glyph is at either end of the fade. */
export const UPDATE_FADE_SCALE = 0.6

/**
 * What makes a new layer: the state, and whether a download shows its percentage. Not the progress,
 * which redraws the ring in place.
 */
export function updateLayerKey(status: UpdateStatus, showPercent: boolean): string {
  return status.kind === 'downloading' && showPercent ? 'downloading-percent' : status.kind
}
