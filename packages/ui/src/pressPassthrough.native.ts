/**
 * Lets a touch reach the `PressArea` wrapped around the frame.
 *
 * tamagui attaches its own press handling to any view that *declares* a `pressStyle`, whether or
 * not it was given an `onPress` -- so the frame kept claiming the touch and the `Pressable` around
 * it never saw one, which left the button unable to fire at all. The frame is decoration on
 * native; the gesture belongs to the wrapper.
 */
export const PRESS_PASSTHROUGH = { pointerEvents: 'none' } as const
