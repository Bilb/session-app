import { ELEMENT } from '@session/test-ids'
import { Text, useFontScale, useWindowSize, YStack } from '@session/ui'
import { useState } from 'react'

import { accountIdLines } from './accountIdLines'

/**
 * The ID, one element per line, so the text engine cannot move the breaks -- until the first line
 * no longer fits on one line, at a large system text size or in a narrow window. Then each fixed
 * line would wrap on its own and leave a short run of characters under it, so the ID becomes one
 * text that wraps where the width runs out instead.
 *
 * Which of the two is decided by the first line's own layout, the only measure of whether it fits.
 * The web reports no text layout and has no system text size, so it keeps the fixed lines. The
 * decision is remade when the text size or the window changes, since either can make it fit again.
 */
export function AccountIdText({ sessionId }: { sessionId: string }) {
  const fontScale = useFontScale()
  const { width } = useWindowSize()
  const measuredAt = `${fontScale}:${width}`
  const [wrapsAt, setWrapsAt] = useState<string | null>(null)
  const natural = wrapsAt === measuredAt

  return (
    <YStack alignItems="center" alignSelf="stretch" testID={ELEMENT.settings.accountId}>
      {natural ? (
        <Text size="$bodyLarge" fontFamily="$mono" textAlign="center">
          {sessionId}
        </Text>
      ) : (
        accountIdLines(sessionId).map((line, at) => (
          // Keyed by position: lines can repeat (the fake's IDs are runs of zeroes), and duplicate
          // keys crash on iOS.
          <Text
            key={at}
            size="$bodyLarge"
            fontFamily="$mono"
            {...(at === 0
              ? {
                  onTextLayout: (event: { nativeEvent: { lines: readonly unknown[] } }) => {
                    if (event.nativeEvent.lines.length > 1) setWrapsAt(measuredAt)
                  },
                }
              : {})}
          >
            {line}
          </Text>
        ))
      )}
    </YStack>
  )
}
