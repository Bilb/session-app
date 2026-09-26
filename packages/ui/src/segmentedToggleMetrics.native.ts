import { MIN_HIT_TARGET } from './buttonHitTarget'

/**
 * Drawn at the touch floor, so the segment is its own target. A slop would reach it only by
 * overlapping the neighbour's, where the segment drawn later wins rather than the nearer one.
 */
export const SEGMENT_HEIGHT = MIN_HIT_TARGET
export const SEGMENT_WIDTH = MIN_HIT_TARGET
