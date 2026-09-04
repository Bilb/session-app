import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

/**
 * A screen's outermost frame.
 *
 * It fills whatever it is given rather than claiming a viewport: how tall the window is
 * belongs to the app, not to a screen that runs inside a pane on a tablet and full-bleed on
 * a phone.
 */
export function Screen({
  children,
  padded = false,
  testID,
}: {
  children: ReactNode
  padded?: boolean
  testID?: string
}) {
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
