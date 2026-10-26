import { formatDateHeader } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Text, YStack } from '@session/ui'

import { useTimeFormats } from './timeFormats'
import { useToday } from './today'

/**
 * The date above a message that starts a new stretch of the conversation. See `showsDateHeader`.
 *
 * `$textSecondary`, the role THEMING.md gives a timestamp, rather than the legacy clients' body
 * text: it labels the messages under it and should not compete with them.
 *
 * Belongs below an unread marker on the same message: the date is part of what is unread.
 */
export function DateHeaderRow({ timestampMs }: { timestampMs: number }) {
  const formats = useTimeFormats()
  // Read for its change: a header that says a weekday or the time alone is redrawn when the day
  // turns, so a transcript left open past midnight does not go on calling yesterday today.
  useToday()
  const label = formatDateHeader(timestampMs, Date.now(), formats)
  return (
    <YStack alignItems="center" paddingVertical="$sm" testID={ELEMENT.conversation.dateHeader}>
      <Text size="$caption" weight="bold" tone="secondary">
        {label}
      </Text>
    </YStack>
  )
}
