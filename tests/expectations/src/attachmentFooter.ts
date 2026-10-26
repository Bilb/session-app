import { PENDING_COPY, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import type { Expected } from './node'
import { pressArea } from './pressArea'

export const FOOTER_ID = ELEMENT.conversation.attachmentFooter
export const FOOTER_ACTION_ID = ELEMENT.conversation.attachmentAction

export type AttachmentSetState = 'ready' | 'fetching' | 'failed' | 'idle' | 'unavailable'

/**
 * The footer's one verb, absent where the set offers none: nothing while a transfer runs or the
 * files are gone, and no Export for several files, which would need a folder to put them in.
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
