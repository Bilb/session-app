import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import type { KeyboardAvoidingProps } from './KeyboardAvoiding.types'

export type { KeyboardAvoidingProps }

const FILL = { flex: 1 } as const

/**
 * Holds its children clear of the keyboard, and only its children.
 *
 * `Screen` already does this for the whole frame, which is right almost everywhere: a screen is a
 * column of content and a field near the bottom of it, and lifting the column is what should
 * happen. Onboarding on a tablet is the exception -- the frame is artwork beside a column, and
 * lifting the frame lifted the artwork too, which visibly shrank a picture that has nothing to do
 * with the field being typed into. So the frame opts out and the column wraps itself in this.
 *
 * Same implementation as `Screen`'s, and the same reason for it: the platform's own avoiding view
 * replays a guess at the keyboard's animation, where this follows the keyboard's own.
 */
export function KeyboardAvoiding({ children }: KeyboardAvoidingProps) {
  return (
    <KeyboardAvoidingView style={FILL} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  )
}
