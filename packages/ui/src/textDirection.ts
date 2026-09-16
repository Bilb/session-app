/**
 * Mirrors the layout, or puts it back.
 *
 * The web half. `dir` on the root element is what makes `end`, `start`, `marginStart` and the rest
 * resolve to the other side, so every logical edge in the app follows from this one line. Set on
 * `documentElement` rather than on a wrapper so that anything portalled out of the tree -- a
 * dialog, a dropdown -- is mirrored too.
 */
export function applyDirection(rtl: boolean): void {
  document.documentElement.dir = rtl ? 'rtl' : 'ltr'
}
