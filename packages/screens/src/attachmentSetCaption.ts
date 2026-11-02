import { formatBytes } from '@session/basic-types'
import { PENDING_COPY, tr } from '@session/localization'

import type { AttachmentSet } from './attachmentSet'

/**
 * What it weighs and how many there are, which is what somebody deciding to fetch it needs. The
 * size leads, so a line too narrow for both cuts the count, which the attachments above it show,
 * rather than the size, which nothing else does. The count is English only: no catalogue key
 * takes one.
 */
function idleCaption(set: AttachmentSet): string {
  const count = PENDING_COPY.attachmentCount(set.count)
  return set.sizeBytes === undefined ? count : `${formatBytes(set.sizeBytes)} · ${count}`
}

/**
 * What a set says wherever it is drawn, or null for the states the footer and the pill word
 * differently: a running transfer of known size, and a set that has arrived.
 */
export function sharedCaption(set: AttachmentSet): string | null {
  // The first report of any transfer is 0 of 0: the server has not said how big it is yet.
  if (set.state === 'fetching' && set.totalBytes === 0) return tr('downloading')
  if (set.state === 'failed') return tr('failedToDownload')
  if (set.state === 'unavailable')
    return tr(set.unreadable === set.count ? 'attachmentsErrorOpen' : 'attachmentsExpired')
  if (set.state === 'idle') return idleCaption(set)
  return null
}
