import type { Expected } from './node'

/**
 * A message in a transcript. On the desktop an article the keyboard moves to, with no name of its
 * own so a reader reads on into it; the shared roles have no article, so it reads as `none`. A
 * phone's reader moves between messages by itself, so there it is no element at all.
 */
export const MESSAGE_FRAME = {
  desktop: { role: 'none', name: null, focusable: true },
  native: null,
} as const satisfies Expected
