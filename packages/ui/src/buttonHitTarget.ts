/**
 * The smallest a control's touch target is allowed to be.
 *
 * Apple asks for 44 and Android for 48dp; 40 is this app's floor and below both, so it
 * is a minimum rather than a target. It matters most for `xs`, which is drawn at the size of its
 * glyph -- the right look, and a target barely half what a thumb needs. Onboarding's back and
 * language buttons are both that size, and both were missed until they were pressed on a phone.
 */
export const MIN_HIT_TARGET = 40

/** Button heights by size, so a shortfall can be made up in `hitSlop` rather than in pixels. */
const SIZE_HEIGHT = { xs: 24, sm: 32, md: 40, lg: 48 } as const

export type ButtonSize = keyof typeof SIZE_HEIGHT

/**
 * How far a button of this size has to grow on each side to reach the floor.
 *
 * Half the shortfall, because `hitSlop` applies to every side. Zero where the control is already
 * big enough, so nothing is added where nothing is needed.
 */
export function hitSlopFor(size: ButtonSize): number {
  return Math.max(0, (MIN_HIT_TARGET - SIZE_HEIGHT[size]) / 2)
}
