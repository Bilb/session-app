/**
 * When a keyboard-avoiding view should hold its last height rather than follow the keyboard.
 *
 * Pure, and in its own module so it can be tested: the hook around it reaches for `react-native`,
 * and a test that imports that gets Flow syntax vitest cannot parse.
 */

/**
 * Whether the window changed size, as opposed to being measured for the first time.
 *
 * The window changes before any keyboard event -- 38ms ahead of them on the rotation this was
 * measured on -- which is what makes it the signal to arm on.
 *
 * The off-by-one is not a small mistake: treating a first measurement as a change starts a hold on
 * every mount, which pins the avoidance at whatever the keyboard happened to be doing.
 */
export function windowSizeChanged(previous: string | null, next: string): boolean {
  return previous !== null && previous !== next
}

/**
 * How far through being replaced the keyboard is.
 *
 * `waiting` is the gap this exists to cover: the old keyboard has gone and the new one has not
 * arrived. iOS usually replaces rather than resizes, so the height reported goes old, then
 * **zero**, then new -- and an avoiding view following it draws that zero, which drops the content
 * and brings it back.
 */
export type Replacement = 'before' | 'waiting' | 'done'

/**
 * Where a hold has got to, given the height reported since it was armed.
 *
 * **Two ways to be done, because the keyboard takes two routes and only one has a gap.** Measured
 * on an iPad, a rotation usually reports old, zero, new -- but sometimes goes straight from one
 * height to the other with nothing in between. Waiting only for a zero leaves that second case
 * held until the ceiling expires; comparing only heights misses a replacement that happens to be
 * the same size as what it replaced. So a zero advances, and so does a height that differs from
 * the one being held.
 *
 * What must not advance it is the *first* report, which is still the old keyboard's own height --
 * that is what released an earlier version of this immediately, holding nothing at all.
 */
export function advance(stage: Replacement, keyboardHeight: number, held: number): Replacement {
  if (stage === 'done') return 'done'
  if (keyboardHeight === 0) return 'waiting'
  return stage === 'waiting' || keyboardHeight !== held ? 'done' : 'before'
}
