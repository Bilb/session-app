/**
 * Pins an absolutely positioned child to the trailing edge of its parent.
 *
 * The native half, where `end` is react-native's own and already means this. No style override is
 * wanted: `insetInlineEnd` is a CSS property react-native does not know, and passing it would be a
 * warning rather than a position.
 */
export function trailingInset(value: number): { end: number } {
  return { end: value }
}
