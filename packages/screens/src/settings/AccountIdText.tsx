import { ELEMENT } from '@session/test-ids'
import { Text, YStack } from '@session/ui'

import { accountIdLines } from './accountIdLines'

/** The ID, one element per line, so the text engine cannot move the breaks. */
export function AccountIdText({ sessionId }: { sessionId: string }) {
  return (
    <YStack alignItems="center" testID={ELEMENT.settings.accountId}>
      {accountIdLines(sessionId).map((line, at) => (
        // Keyed by position: lines can repeat (the fake's IDs are runs of zeroes), and duplicate
        // keys crash on iOS.
        <Text key={at} size="$bodyLarge" fontFamily="$mono">
          {line}
        </Text>
      ))}
    </YStack>
  )
}
