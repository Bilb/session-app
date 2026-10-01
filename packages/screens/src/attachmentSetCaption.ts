import { tr } from '@session/localization'

import type { AttachmentSet } from './attachmentSet'

/**
 * What a set says wherever it is drawn, or null for the states the footer and the pill word
 * differently: a running transfer of known size, and an idle set.
 */
export function sharedCaption(set: AttachmentSet): string | null {
  // The first report of any transfer is 0 of 0: the server has not said how big it is yet.
  if (set.state === 'fetching' && set.totalBytes === 0) return tr('downloading')
  if (set.state === 'failed') return tr('failedToDownload')
  if (set.state === 'unavailable')
    return tr(set.unreadable === set.count ? 'attachmentsErrorOpen' : 'attachmentsExpired')
  return null
}
