import { YStack } from 'tamagui'

import type { SafeAreaProps } from './SafeArea.types'

export type { SafeAreaProps }

/**
 * Keeps its children clear of the notch and the home indicator. Nothing to do on the web.
 *
 * A desktop window has neither, so this is the pass-through half of the pair and exists only so a
 * screen can be written once. See SafeArea.native.tsx, where it does the work.
 */
export function SafeArea({ children }: SafeAreaProps) {
  return <YStack flex={1}>{children}</YStack>
}
