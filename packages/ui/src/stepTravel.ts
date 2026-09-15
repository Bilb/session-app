/**
 * How far the screen that is not travelling the full width moves, as a fraction of it.
 *
 * Both platforms move it a little rather than the whole way -- a third on iOS, a quarter on
 * Android -- which is what makes a push read as one screen sliding over another rather than as two
 * screens swapping places.
 */
const TRAIL = 1 / 3

export interface StepTravel {
  /** Where the arriving screen starts, relative to its resting position. */
  enters: number
  /** Where the departing screen ends up. */
  leaves: number
}

/**
 * Where the two screens of a push or a pop start and finish.
 *
 * **A pop is not a push with the signs flipped**, which is the mistake this exists to stop anyone
 * making twice. Pushing, the new screen covers the old one: it travels the whole width and the old
 * one drifts a third of the way off. Popping, the *old* screen uncovers what is behind it: the
 * departing screen travels the whole width and the one being returned to is already a third of the
 * way on screen, sliding back to rest. Flipping the signs instead sent the departing screen only a
 * third of the way and left it sitting there until the animation ended and it vanished.
 */
export function stepTravel(width: number, direction: 'forward' | 'back'): StepTravel {
  if (direction === 'forward') return { enters: width, leaves: -width * TRAIL }
  return { enters: -width * TRAIL, leaves: width }
}
