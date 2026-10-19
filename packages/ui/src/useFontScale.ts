import { useWindowDimensions } from 'react-native'

/**
 * The system text size as a multiple of the default, re-rendering whoever asks when it changes.
 *
 * React Native scales every piece of text by this on its own; this is for the layout around text
 * that has to grow in step and cannot measure first -- a fixed-height list row. 1 on the web,
 * where react-native-web reports no text size and the browser's zoom scales the whole page.
 */
export function useFontScale(): number {
  return useWindowDimensions().fontScale
}
