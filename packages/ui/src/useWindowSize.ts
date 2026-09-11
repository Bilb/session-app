import { useWindowDimensions } from 'react-native'

/**
 * The window's shape, for the rare decision that width alone cannot make.
 *
 * `useMedia` answers almost everything: how many panes fit is a question about width, and the
 * breakpoints in config.ts are where that lives. Orientation is the exception -- a tablet held
 * upright and the same tablet on its side are both "wide", and a layout that fills the height with
 * something can only tell them apart by comparing the two.
 *
 * Reach for `useMedia` first. This exists for orientation, and orientation is what it returns.
 */
export function useWindowSize(): { width: number; height: number; portrait: boolean } {
  const { width, height } = useWindowDimensions()
  return { width, height, portrait: height > width }
}
