import { XStack } from 'tamagui'

import type { PressAreaProps } from './PressArea.types'

export type { PressAreaProps }

/**
 * The web half: tamagui handles the press and the styling, so there is nothing to track.
 *
 * `pressed` is always false here and the frame inside styles itself through `pressStyle`, which is
 * a CSS pseudo-class on the web and needs no state. See PressArea.native.tsx, where it does not.
 */
export function PressArea({
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
  children,
}: PressAreaProps) {
  return (
    <XStack
      role="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {children(false)}
    </XStack>
  )
}
