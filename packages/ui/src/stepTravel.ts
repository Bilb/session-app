/**
 * How far the screen being left behind travels, as a fraction of the width.
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
 * Where the two screens of a push start and finish.
 *
 * Split out of the component because it is the part that is wrong in a way nobody can see in a
 * still: a sign flipped here makes back and forward look identical, and both look plausible.
 */
export function stepTravel(width: number, direction: 'forward' | 'back'): StepTravel {
  const away = direction === 'forward' ? 1 : -1
  return { enters: width * away, leaves: -width * TRAIL * away }
}
