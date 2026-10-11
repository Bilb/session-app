import { isWeb } from 'tamagui'

/** Only what the handler reads, so it can take a DOM event or a test's stand-in for one. */
export interface PressKeyEvent {
  key: string
  repeat: boolean
  target: unknown
  currentTarget: unknown
  preventDefault: () => void
}

/**
 * Presses on Enter or Space, as a `<button>` does, and only when the focused element is this one:
 * keys bubble, and a control nested in a pressable row must not press the row as well.
 */
export function pressOnKey(onPress: () => void): (event: PressKeyEvent) => void {
  return (event) => {
    if (event.target !== event.currentTarget || event.repeat) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    // Space would otherwise scroll whatever the control sits in.
    event.preventDefault()
    onPress()
  }
}

/**
 * The ring a keyboard user follows, in the accent: the colour the theme gives tamagui's focus
 * aliases and a focused Input's border. On an accent fill, a bubble you sent, it would vanish.
 *
 * The radius rounds the ring to the shape the control draws, and is set only while focused so
 * nothing changes for a view that is never focused.
 */
export function focusRing({
  onAccent,
  offset,
  radius,
}: {
  onAccent: boolean
  offset: number
  radius: number | '$sm' | '$full'
}) {
  return {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: onAccent ? '$onAccent' : '$primaryColor',
    outlineOffset: offset,
    borderRadius: radius,
  } as const
}

/**
 * The tab stop, keys and focus ring of a `<button>`, for a stack with `role="button"`: tamagui
 * hands `onPress` a click and nothing else. Absent where the stack takes no press.
 *
 * Web only. On native a `tabIndex` makes the view one accessibility element, which on iOS would
 * hide whatever is nested in it from VoiceOver.
 */
export function keyboardPress(
  onPress: (() => void) | undefined,
  ring: ReturnType<typeof focusRing>,
) {
  if (!isWeb || onPress === undefined) return {}
  return { tabIndex: 0, onKeyDown: pressOnKey(onPress), focusVisibleStyle: ring }
}
