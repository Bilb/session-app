import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import type { Expected } from './node'

export const FETCH_HINT_ID = ELEMENT.conversation.attachmentFetch

/**
 * The cloud over an album that fetches the set, the three-up's included. Pointer only on the
 * desktop, since its tiles take the keyboard; hidden on native, where the footer offers the verb.
 */
export function fetchHint({ name }: { name: string }): Expected {
  return { desktop: { role: 'button', name, focusable: false }, native: null }
}

/** The cloud's word for the set, which is the footer's. */
export function setFetchName(failed: boolean): string {
  return failed ? tr('retry') : tr('download')
}
