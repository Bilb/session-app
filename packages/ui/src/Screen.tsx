import { YStack } from 'tamagui'

import type { ScreenProps } from './Screen.types'

export type { ScreenProps }

/**
 * A screen's outermost frame.
 *
 * It fills whatever it is given rather than claiming a viewport: how tall the window is
 * belongs to the app, not to a screen that runs inside a pane on a tablet and full-bleed on
 * a phone.
 *
 * `edges` is accepted and ignored here. A desktop window has no notch and no home indicator,
 * and the prop exists on both variants so a screen can be written once — see Screen.native.tsx,
 * where it is the whole point.
 */
export function Screen({ children, padded = false, testID }: ScreenProps) {
  return (
    <YStack
      flex={1}
      backgroundColor="$backgroundPrimary"
      {...(padded ? { padding: '$2' } : {})}
      testID={testID}
    >
      {children}
    </YStack>
  )
}
