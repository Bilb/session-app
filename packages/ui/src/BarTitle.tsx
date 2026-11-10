import type { BarTitleProps } from './BarTitle.types'
import { Text } from './Text'

/**
 * A top bar's title on the desktop: 16 bold, the size the current desktop app gives a
 * conversation's name. The phones draw it larger: see `BarTitle.native.tsx`.
 */
export function BarTitle({ children, centred = false, testID }: BarTitleProps) {
  return (
    <Text
      size="$bodyLarge"
      weight="bold"
      numberOfLines={1}
      {...(centred ? { textAlign: 'center' as const } : {})}
      testID={testID}
    >
      {children}
    </Text>
  )
}

export type { BarTitleProps } from './BarTitle.types'
