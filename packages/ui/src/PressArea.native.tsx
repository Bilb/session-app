import { Pressable } from 'react-native'

import type { PressAreaProps } from './PressArea.types'

export type { PressAreaProps }

/**
 * The native half, and the reason this split exists at all.
 *
 * **tamagui's own press does not behave like the platform's.** Its native gesture is a
 * `Gesture.Manual()` whose `onTouchesUp` calls `onPress` unconditionally -- there is no check that
 * the finger is still inside the control. So a touch that starts on a button, slides off it and
 * lifts elsewhere keeps the highlight the whole way and then fires the button, where iOS clears
 * the highlight as the finger leaves and does nothing on release. As it was put in review:
 * *"a behaviour like this is how users can tell something isn't native. But it also feels like a
 * bug"*.
 *
 * `Pressable` is react-native's own implementation of the platform's rules, including the slop a
 * finger is allowed before the press is abandoned, so this hands the gesture to it and reports the
 * state upwards rather than restating those rules.
 */
export function PressArea({
  onPress,
  disabled = false,
  fill = false,
  hitSlop,
  accessibilityLabel,
  testID,
  children,
}: PressAreaProps) {
  return (
    <Pressable
      {...(fill ? { style: { flex: 1 } } : {})}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      {...(hitSlop === undefined || hitSlop === 0 ? {} : { hitSlop })}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {({ pressed }) => children(pressed)}
    </Pressable>
  )
}
