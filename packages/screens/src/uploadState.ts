import type { Message } from '@session/client'

import type { Fetch } from './attachmentFetch'

/**
 * Where one file of a message being sent has got to.
 *
 * Read from `uploaded` and the message's send state alone, which is all the bridge carries: there
 * is no upload progress on it yet. That is enough because libsession uploads a message's files one
 * at a time in index order and stops at the first that fails, so the first file without a URL is
 * the one moving, or the one that failed, and every file after it has not been tried.
 */
export type UploadState = 'uploaded' | 'uploading' | 'queued' | 'failed' | 'notSent'

const SENDING_STATES: readonly Message['sendState'][] = [
  'uploading',
  'failed',
  'interrupted',
  'unsendable',
]

/**
 * Whether a message's files are still the story: one of ours whose set has not all reached the
 * file server. A set that uploaded in full and then failed to send is a message failure, said by
 * the message, with nothing to say per file.
 */
export function isUploadPhase(message: Message): boolean {
  return (
    message.outgoing &&
    SENDING_STATES.includes(message.sendState) &&
    message.attachments.some((attachment) => !attachment.uploaded)
  )
}

function firstWaiting(message: Message): number | undefined {
  let first: number | undefined
  for (const attachment of message.attachments) {
    if (attachment.uploaded) continue
    if (first === undefined || attachment.index < first) first = attachment.index
  }
  return first
}

export function uploadStateOf(message: Message, index: number): UploadState {
  const attachment = message.attachments.find((candidate) => candidate.index === index)
  if (attachment === undefined || attachment.uploaded) return 'uploaded'
  const current = index === firstWaiting(message)
  switch (message.sendState) {
    case 'uploading':
      return current ? 'uploading' : 'queued'
    case 'failed':
    case 'interrupted':
      return current ? 'failed' : 'notSent'
    // A file of it is missing, and nothing says which: no row is singled out.
    default:
      return 'notSent'
  }
}

export interface UploadSummary {
  uploaded: number
  count: number
  /** Whether Retry is worth offering. `unsendable` is a missing file, which a retry re-reads. */
  retryable: boolean
}

export function uploadSummary(message: Message): UploadSummary {
  return {
    uploaded: message.attachments.filter((attachment) => attachment.uploaded).length,
    count: message.attachments.length,
    retryable: message.sendState === 'failed' || message.sendState === 'interrupted',
  }
}

/** Whether a file past the first `shown` failed, for a "Show All" that hides it. */
export function failsPast(message: Message, shown: number): boolean {
  return message.attachments
    .slice(shown)
    .some((attachment) => uploadStateOf(message, attachment.index) === 'failed')
}

/** Where the failed file sits in the set, for a list to open on. */
export function firstFailedPosition(message: Message): number | undefined {
  const position = message.attachments.findIndex(
    (attachment) => uploadStateOf(message, attachment.index) === 'failed',
  )
  return position < 0 ? undefined : position
}

/**
 * A file of ours as an album draws it while the set is sending: here, or quiet.
 *
 * Never a download: a file of ours that is not cached has no URL until it uploads, so fetching it
 * fails, and asking which files this conversation should fetch is not a question about our own.
 */
export function whileSending(fetch: Fetch): Fetch {
  return fetch.state === 'ready' ? fetch : { state: 'unavailable', doneBytes: 0, totalBytes: 0 }
}
