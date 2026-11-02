import { YStack } from '@session/ui'
import { useState, type ReactNode } from 'react'

import { TranscriptWidthContext } from './albumSize'

/**
 * Measures what it is laid out at and tells the messages inside that the transcript is that wide,
 * since an album takes a share of the transcript it is in and never more than fits there.
 */
export function TranscriptWidth({
  flex,
  children,
}: {
  flex?: number | undefined
  children: ReactNode
}) {
  const [widthPx, setWidthPx] = useState<number | null>(null)
  return (
    <TranscriptWidthContext.Provider value={widthPx}>
      <YStack
        flex={flex}
        onLayout={(event) => {
          setWidthPx(event.nativeEvent.layout.width)
        }}
      >
        {children}
      </YStack>
    </TranscriptWidthContext.Provider>
  )
}
