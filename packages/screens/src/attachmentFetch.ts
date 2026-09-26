import type { Attachment } from '@session/client'
import type { AttachmentTransferState } from '@session/state'

/** What one attachment's bytes are doing, as far as anything drawing it is concerned. */
export type FetchState = 'idle' | 'fetching' | 'ready' | 'failed' | 'unavailable'

export interface Fetch {
  state: FetchState
  /** Encrypted bytes moved and expected. Both 0 unless something is running. */
  done: number
  total: number
}

/**
 * One attachment's state, from what libsession says plus whatever this session has heard.
 *
 * **The attachment is the resting truth and a report is the live one.** `availability` arrives
 * with the message and is corrected whenever it changes, so it is right after a restart, after
 * scrolling back to an old message, and for a transfer somebody else's tap started. What it
 * cannot say is that a fetch *failed* transiently - libsession records only failures that will
 * not come out differently - so a report is still the only thing that knows a download has just
 * given up, and it carries fresher figures while one is running.
 */
export function fetchOf(attachment: Attachment, report?: AttachmentTransferState): Fetch {
  const none = { done: 0, total: 0 }

  // A verdict on the file rather than on this attempt, so retrying will not change it. Checked
  // before the cached case cannot arise: libsession reports one availability, and a copy in the
  // cache outranks what the last fetch of it found.
  if (attachment.availability === 'notFound' || attachment.availability === 'unreadable')
    return { state: 'unavailable', ...none }

  if (report?.state === 'failed') return { state: 'failed', ...none }
  if (attachment.availability === 'cached' || report?.state === 'done')
    return { state: 'ready', ...none }

  if (report?.state === 'running')
    return { state: 'fetching', done: report.doneBytes, total: report.totalBytes }
  if (attachment.availability === 'fetching')
    return {
      state: 'fetching',
      done: attachment.fetchDoneBytes,
      total: attachment.fetchTotalBytes,
    }

  return { state: 'idle', ...none }
}
