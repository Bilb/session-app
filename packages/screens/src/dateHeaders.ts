import type { Message } from '@session/client'

/** A gap longer than this between two messages starts a new header. */
export const DATE_HEADER_GAP_MS = 5 * 60_000

const MS_PER_DAY = 86_400_000

/** A local calendar day as a whole number, through `Date.UTC` so daylight saving cannot skew it. */
function localDay(timestampMs: number): number {
  const date = new Date(timestampMs)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
}

/**
 * Whether `message` gets a date header above it: more than `DATE_HEADER_GAP_MS` after the message
 * before it, or on another local day, whoever sent either. A day change counts on its own so that
 * two messages a minute either side of midnight still show the new day.
 *
 * With no message before it, only when it is the oldest in the conversation (`isOldest`). The first
 * message of a page that can still load older has a neighbour that is not loaded yet, and a header
 * guessed there would vanish as soon as it arrived.
 */
export function showsDateHeader(
  previous: Pick<Message, 'timestamp'> | undefined,
  message: Pick<Message, 'timestamp'>,
  isOldest: boolean,
): boolean {
  if (previous === undefined) return isOldest
  return (
    message.timestamp - previous.timestamp > DATE_HEADER_GAP_MS ||
    localDay(message.timestamp) !== localDay(previous.timestamp)
  )
}
