import { YStack } from 'tamagui'

import type { KeyboardAvoidingProps } from './KeyboardAvoiding.types'

export type { KeyboardAvoidingProps }

/**
 * Holds its children clear of the keyboard. Nothing to do on the web.
 *
 * A desktop window has no keyboard drawn over it, so this is the pass-through half of the pair and
 * exists only so a screen can be written once. See KeyboardAvoiding.native.tsx.
 */
export function KeyboardAvoiding({ children }: KeyboardAvoidingProps) {
  return <YStack flex={1}>{children}</YStack>
}
