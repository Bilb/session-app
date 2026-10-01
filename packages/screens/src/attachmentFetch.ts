import type { Attachment } from '@session/client'
import type { AttachmentTransferState } from '@session/state'

/** What one attachment's bytes are doing, as far as anything drawing it is concerned. */
export type FetchState = 'idle' | 'fetching' | 'ready' | 'failed' | 'unavailable'

export interface Fetch {
  state: FetchState
  /** Encrypted bytes moved and expected. Both 0 unless something is running. */
  doneBytes: number
  totalBytes: number
}

/**
 * One attachment's state, from what libsession says plus whatever this session has heard.
 *
 * **The attachment is the resting truth and a report is the live one.** `availability` arrives
 * with the message and is corrected whenever it changes - a fetch finishing, the cache evicting
 * it - so it alone says the bytes are here. What it cannot say is that a fetch *failed*
 * transiently, since libsession records only failures that will not come out differently, so a
 * failed report is what says a download just gave up, and a running one carries fresher figures.
 */
export function fetchOf(attachment: Attachment, report?: AttachmentTransferState): Fetch {
  const none = { doneBytes: 0, totalBytes: 0 }

  // A verdict on the file rather than on this attempt, so retrying will not change it.
  if (attachment.availability === 'notFound' || attachment.availability === 'unreadable')
    return { state: 'unavailable', ...none }
  // Beats a failed report: the bytes can land by another route, such as another message
  // naming the same file, and a cache hit reports nothing that would replace the failure.
  if (attachment.availability === 'cached') return { state: 'ready', ...none }
  // The download resolves before the message carrying `cached` is announced, and the store drops
  // this report once it is, so it cannot outlive an eviction.
  if (report?.state === 'done') return { state: 'ready', ...none }

  if (report?.state === 'running')
    return { state: 'fetching', doneBytes: report.doneBytes, totalBytes: report.totalBytes }
  if (attachment.availability === 'fetching')
    return {
      state: 'fetching',
      doneBytes: attachment.fetchDoneBytes,
      totalBytes: attachment.fetchTotalBytes,
    }
  if (report?.state === 'failed') return { state: 'failed', ...none }

  return { state: 'idle', ...none }
}
