import type { BarTitleProps } from './BarTitle.types'
import { Text } from './Text'

/**
 * A top bar's title on a phone or tablet: 23 bold, the size both current mobile apps give a
 * conversation's name (iOS's H5, Android's h5). The desktop draws it at 16: see `BarTitle.tsx`.
 */
export function BarTitle({ children, centred = false, testID }: BarTitleProps) {
  return (
    <Text
      size="$heading"
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
