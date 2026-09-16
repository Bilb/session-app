/**
 * Which way the layout is currently laid out, as rendered.
 *
 * The web half: `dir` on the root element, which `applyDirection` sets.
 */
export function isLayoutRtl(): boolean {
  return document.documentElement.dir === 'rtl'
}
