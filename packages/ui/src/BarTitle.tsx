import type { ReactNode } from 'react'
import { isWeb } from 'tamagui'

import { Text } from './Text'

export interface BarTitleProps {
  children: ReactNode
  /** Centred in the bar, as a conversation's name is; otherwise from the start edge. */
  centred?: boolean | undefined
  testID?: string | undefined
}

/**
 * A top bar's title: 16 bold on the desktop, the size the current desktop app gives a
 * conversation's name, and 23 bold on a phone or tablet, the size both current mobile apps give it
 * (iOS's H5, Android's h5).
 */
export function BarTitle({ children, centred = false, testID }: BarTitleProps) {
  return (
    <Text
      size={isWeb ? '$bodyLarge' : '$heading'}
      weight="bold"
      numberOfLines={1}
      {...(centred ? { textAlign: 'center' as const } : {})}
      testID={testID}
    >
      {children}
    </Text>
  )
}
