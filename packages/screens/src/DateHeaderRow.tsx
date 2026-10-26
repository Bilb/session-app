import { formatDateHeader } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Text, YStack } from '@session/ui'

import { useFormattingLocale } from './useLocale'

/**
 * The date above a message that starts a new stretch of the conversation. See `showsDateHeader`.
 *
 * `$textSecondary`, the role THEMING.md gives a timestamp, rather than the legacy clients' body
 * text: it labels the messages under it and should not compete with them.
 *
 * Belongs below an unread marker on the same message: the date is part of what is unread.
 */
export function DateHeaderRow({ timestampMs }: { timestampMs: number }) {
  const locale = useFormattingLocale()
  // TODO: "today" is read at render, so a transcript left open past midnight keeps yesterday's
  // headers worded as today's until it is drawn again; redraw it when the day turns.
  const label = formatDateHeader(timestampMs, Date.now(), { locale })
  return (
    <YStack alignItems="center" paddingVertical="$sm" testID={ELEMENT.conversation.dateHeader}>
      <Text size="$caption" weight="bold" tone="secondary">
        {label}
      </Text>
    </YStack>
  )
}
