import { I18nManager } from 'react-native'

/**
 * The direction the tree is laid out in, and the one place that remembers it.
 *
 * Seeded from `I18nManager` because that is what the *first* frame is laid out against: a device
 * set to Arabic starts the process mirrored before anybody has chosen a language. After that it is
 * whatever `applyDirection` last set, which is the language the picker is showing.
 */
let rtl = I18nManager.isRTL

/** Records the direction the tree is now laid out in. See `textDirection.native`. */
export function setLayoutRtl(next: boolean): void {
  rtl = next
}

/**
 * Which way the layout is currently laid out, as rendered.
 *
 * Anything that has to agree with the layout asks here rather than asking the language. Yoga
 * mirrors the edges it owns, but it does not mirror a `translateX` or a measured rectangle, so
 * which way a page slides in from and which way a chevron points have to be told.
 */
export function isLayoutRtl(): boolean {
  return rtl
}
