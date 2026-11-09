import { PENDING_COPY, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import type { Expected } from './node'
import { pressArea } from './pressArea'

export const FOOTER_ID = ELEMENT.conversation.attachmentFooter
export const FOOTER_ACTION_ID = ELEMENT.conversation.attachmentAction
export const FOOTER_PROGRESS_ID = ELEMENT.conversation.attachmentProgress

export type AttachmentSetState = 'ready' | 'fetching' | 'failed' | 'idle' | 'unavailable'

/**
 * The footer's one verb, absent where the set offers none: nothing while a transfer runs or the
 * files are gone, and no Export for several files, which would need a folder to put them in. A
 * glyph at every width, so this name is the only place its word is.
 */
export function attachmentFooterAction({
  state,
  count,
}: {
  state: AttachmentSetState
  count: number
}): Expected {
  const name =
    state === 'fetching' || state === 'unavailable'
      ? null
      : state === 'failed'
        ? tr('retry')
        : state === 'ready'
          ? count === 1
            ? PENDING_COPY.export
            : null
          : tr('download')
  return name === null ? { desktop: null, native: null } : pressArea({ name })
}

/**
 * A running download's ring, in the verb's place: a progress bar named for what it is doing, and
 * no stop, because there is nothing to do to it until the bridge can cancel a transfer.
 */
export function attachmentFooterProgress(): Expected {
  const node = { role: 'progressbar', name: tr('downloading') } as const
  return { desktop: { ...node, focusable: false }, native: node }
}
