import type { Message } from '@session/client'
import { localDay } from './today'

/** A gap longer than this between two messages starts a new header. */
export const DATE_HEADER_GAP_MS = 5 * 60_000

/**
 * Whether `message` gets a date header above it: more than `DATE_HEADER_GAP_MS` after the message
 * before it, or on another local day, whoever sent either. A day change counts on its own so that
 * two messages a minute either side of midnight still show the new day.
 *
 * Always above the first message loaded, so the top of what is shown says when it is from. Once an
 * older page is loaded above it, it is compared with that page's last message like any other.
 */
export function showsDateHeader(
  previous: Pick<Message, 'timestamp'> | undefined,
  message: Pick<Message, 'timestamp'>,
): boolean {
  if (previous === undefined) return true
  return (
    message.timestamp - previous.timestamp > DATE_HEADER_GAP_MS ||
    localDay(message.timestamp) !== localDay(previous.timestamp)
  )
}
