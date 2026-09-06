import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { YStack } from 'tamagui'

import type { ScreenProps } from './Screen.types'

export type { ScreenProps }

const ALL_EDGES = ['top', 'bottom', 'left', 'right'] as const

/**
 * The native flavour: the same frame, held clear of the hardware.
 *
 * Padding rather than a SafeAreaView, because the inset belongs to the content and not to the
 * background - a list that stops short of the bottom of the display looks like a bug, and one
 * that scrolls its rows under the home indicator does not.
 *
 * Two stacks rather than one so that the inset and the padding add up: the inset is a number of
 * pixels the device reports and the padding is a token, and collapsing them into one prop would
 * mean resolving the token here to do the arithmetic.
 *
 * Read through the hook rather than taken as a prop so a screen never has to know which device
 * it is on. It needs a SafeAreaProvider above it, which the app's root layout installs.
 */
export function Screen({ children, padded = false, edges = ALL_EDGES, testID }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const wanted = new Set(edges)

  return (
    <YStack
      flex={1}
      backgroundColor="$backgroundPrimary"
      paddingTop={wanted.has('top') ? insets.top : 0}
      paddingBottom={wanted.has('bottom') ? insets.bottom : 0}
      paddingLeft={wanted.has('left') ? insets.left : 0}
      paddingRight={wanted.has('right') ? insets.right : 0}
      testID={testID}
    >
      <YStack flex={1} {...(padded ? { padding: '$2' } : {})}>
        {children}
      </YStack>
    </YStack>
  )
}
