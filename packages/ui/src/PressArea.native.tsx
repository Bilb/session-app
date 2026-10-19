import { useEffect, useRef, useState } from 'react'
import { Pressable, type PointerEvent } from 'react-native'

import type { PressAreaProps } from './PressArea.types'

export type { PressAreaProps }

/**
 * How long a pointer leaving waits before it clears the hover. Pressing the button ends UIKit's
 * hover, which React Native reports as the pointer leaving, around the moment the press starts;
 * acted on at once, the control drops to its resting style for a frame. So a leave waits this
 * long, an enter cancels it, and one that comes with a press is held until the press ends. Two
 * frames: the leave and the press come from one UIKit event, so the press is never further behind,
 * and a real exit has to clear its hover too soon to see the wait.
 */
const POINTER_LEAVE_DELAY_MS = 32

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
  busy = false,
  testID,
  children,
}: PressAreaProps) {
  const [hovered, setHovered] = useState(false)
  const pendingLeave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressing = useRef(false)
  const leftDuringPress = useRef(false)
  useEffect(() => () => clearTimeout(pendingLeave.current), [])

  const leaveSoon = () => {
    clearTimeout(pendingLeave.current)
    pendingLeave.current = setTimeout(() => {
      pendingLeave.current = undefined
      setHovered(false)
    }, POINTER_LEAVE_DELAY_MS)
  }

  return (
    <Pressable
      // The zero basis spelled out: under `flex: 1` alone each label's width leaks into the split,
      // and two fill buttons with different labels come out different widths.
      {...(fill ? { style: { flexGrow: 1, flexShrink: 1, flexBasis: 0 } } : {})}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      {...(hitSlop === undefined || hitSlop === 0 ? {} : { hitSlop })}
      accessibilityLabel={accessibilityLabel}
      // Stated whole: passing a state replaces the one Pressable derives from `disabled`.
      accessibilityState={{ disabled, busy }}
      testID={testID}
      // A finger reports pointer events too, and it does not hover.
      onPointerEnter={(e: PointerEvent) => {
        if (e.nativeEvent.pointerType === 'touch') return
        clearTimeout(pendingLeave.current)
        pendingLeave.current = undefined
        leftDuringPress.current = false
        setHovered(true)
      }}
      onPointerLeave={(e: PointerEvent) => {
        if (e.nativeEvent.pointerType === 'touch') return
        if (pressing.current) leftDuringPress.current = true
        else leaveSoon()
      }}
      onPressIn={() => {
        pressing.current = true
        if (pendingLeave.current === undefined) return
        clearTimeout(pendingLeave.current)
        pendingLeave.current = undefined
        leftDuringPress.current = true
      }}
      onPressOut={() => {
        pressing.current = false
        if (!leftDuringPress.current) return
        leftDuringPress.current = false
        leaveSoon()
      }}
    >
      {({ pressed }) => children(pressed, hovered && !disabled)}
    </Pressable>
  )
}
