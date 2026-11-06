import { ELEMENT } from '@session/test-ids'

import type { Expected } from './node'

export const MESSAGE_QUOTE_ID = ELEMENT.conversation.messageQuote

/**
 * A reply's quote: one button named "{author}: {summary}" that jumps to the original, busy while it
 * is read in. One offered no press is no button: on the web its words are read where they stand,
 * and on native it is one element saying them.
 */
export function messageQuote({
  name,
  hint,
  pressable,
  busy = false,
}: {
  name: string
  hint: string | null
  /** Offered a press. */
  pressable: boolean
  busy?: boolean | undefined
}): Expected {
  if (!pressable)
    return {
      desktop: { role: 'none', name: null, focusable: false },
      native: { role: 'none', name },
    }
  const node = { role: 'button', name, hint, busy, disabled: false, focusable: true } as const
  return { desktop: node, native: node }
}
