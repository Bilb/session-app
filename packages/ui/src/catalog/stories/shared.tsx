import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

export const noop = () => {}

export const LONG = 'A label long enough to need a second line or an ellipsis at this width'

/** A sent bubble's fill, which is what `onAccent` is drawn on. */
export function AccentFill({ children }: { children: ReactNode }) {
  return (
    <YStack backgroundColor="$primaryColor" borderRadius="$lg" padding="$xs">
      {children}
    </YStack>
  )
}
