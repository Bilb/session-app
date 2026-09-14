import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { YStack } from 'tamagui'

import type { SafeAreaProps } from './SafeArea.types'

export type { SafeAreaProps }

const ALL_EDGES = ['top', 'bottom', 'left', 'right'] as const

/**
 * Keeps its children clear of the notch and the home indicator, *without* claiming the screen.
 *
 * For a layout where something should bleed past the safe area and something else should not --
 * artwork that runs under the status bar beside a column that must stay readable. `Screen` can only
 * answer that question once for everything inside it, so the screen opts out with `edges={[]}` and
 * the part that wants the inset asks for it here.
 *
 * Padding rather than a `SafeAreaView` for the reason Screen gives: the inset belongs to the
 * content, and a view that eats it cannot be nested inside one that already has.
 */
export function SafeArea({ children, edges = ALL_EDGES }: SafeAreaProps) {
  const insets = useSafeAreaInsets()
  const wanted = new Set(edges)

  return (
    <YStack
      flex={1}
      paddingTop={wanted.has('top') ? insets.top : 0}
      paddingBottom={wanted.has('bottom') ? insets.bottom : 0}
      paddingLeft={wanted.has('left') ? insets.left : 0}
      paddingRight={wanted.has('right') ? insets.right : 0}
    >
      {children}
    </YStack>
  )
}
