import { LayoutAnimation } from 'react-native'

/**
 * Asks for the *next* layout change to be animated rather than applied instantly.
 *
 * **This is the half of an arrival that a per-item entrance cannot do.** Fading a new bubble in
 * animates the bubble; it says nothing about the ones already on screen, so they jumped to their
 * new positions in a single frame while the newcomer faded politely into the gap. What reads as a
 * conversation arriving is the *existing* lines sliding up to make room, and that is a layout
 * change, not an entrance.
 *
 * Called immediately before the state update that adds the item. React Native applies it to the
 * one layout pass that follows and then forgets it, which is why it is a call rather than a prop.
 *
 * The curve matches the bubble's own entrance so the two halves move together.
 */
const DURATION_MS = 680

export function animateNextLayout(): void {
  LayoutAnimation.configureNext({
    duration: DURATION_MS,
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  })
}
