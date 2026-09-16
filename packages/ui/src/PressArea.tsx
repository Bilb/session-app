import { YStack } from 'tamagui'

import type { PressAreaProps } from './PressArea.types'

export type { PressAreaProps }

/**
 * The web half: tamagui handles the press and the styling, so there is nothing to track.
 *
 * `pressed` is always false here and the frame inside styles itself through `pressStyle`, which is
 * a CSS pseudo-class on the web and needs no state. See PressArea.native.tsx, where it does not.
 *
 * **A column, because the native half is one.** This split is about the press gesture and nothing
 * else, so the two halves have to lay their child out identically -- and the native half wraps it
 * in a `Pressable`, which is a view, which stacks down the page and stretches its children across.
 * A row stretches the other axis instead, leaving the frame inside sized to its own content: the
 * button drew to the width of its label rather than the width it was given, and a label too long
 * for that width overflowed instead of wrapping.
 */
export function PressArea({
  onPress,
  disabled = false,
  fill = false,
  accessibilityLabel,
  testID,
  children,
}: PressAreaProps) {
  return (
    <YStack
      {...(fill ? { flex: 1 } : {})}
      role="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {children(false)}
    </YStack>
  )
}
