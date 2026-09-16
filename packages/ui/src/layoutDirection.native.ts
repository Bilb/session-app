import { I18nManager } from 'react-native'

/**
 * Which way the layout is currently laid out, as rendered.
 *
 * The native half, and **the reason this asks the layout rather than the language**: react-native
 * reads its direction once when the bridge starts and lays out against it for the life of the
 * process, so choosing a right-to-left language mirrors nothing until the next launch. Anything
 * that has to agree with the layout -- which way a back chevron points, which corner something
 * sits in -- has to ask the same question the layout answered, or it disagrees with what is on
 * screen for a whole run.
 */
export function isLayoutRtl(): boolean {
  return I18nManager.isRTL
}
