import type { Attachment, Message, TransferProgress } from '@session/client'
import { transferKey, type AttachmentTransferState, type MessageTransfers } from '@session/state'

import type { Fetch } from './attachmentFetch'

/**
 * Where one file of a message being sent has got to.
 *
 * Read from `uploaded`, the message's send state and the uploads' reports. That is enough because
 * libsession uploads a message's files one at a time in index order and stops at the first that
 * fails, so the first file not up is the one moving, or the one that failed, and every file after
 * it has not been tried.
 */
export type UploadState = 'uploaded' | 'uploading' | 'queued' | 'failed' | 'notSent'

const NO_UPLOADS: MessageTransfers = {}

/**
 * Up on the file server. A finished report counts as well as `uploaded`: libsession announces a
 * file's URL with the message, which for a file sent as it is waits until the whole set is up.
 */
function isUp(attachment: Attachment, uploads: MessageTransfers): boolean {
  return attachment.uploaded || uploads[transferKey('upload', attachment.index)]?.state === 'done'
}

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

function firstWaiting(message: Message, uploads: MessageTransfers): number | undefined {
  let first: number | undefined
  for (const attachment of message.attachments) {
    if (isUp(attachment, uploads)) continue
    if (first === undefined || attachment.index < first) first = attachment.index
  }
  return first
}

export function uploadStateOf(
  message: Message,
  index: number,
  uploads: MessageTransfers = NO_UPLOADS,
): UploadState {
  const attachment = message.attachments.find((candidate) => candidate.index === index)
  if (attachment === undefined || isUp(attachment, uploads)) return 'uploaded'
  const current = index === firstWaiting(message, uploads)
  switch (message.sendState) {
    case 'uploading':
      return current ? 'uploading' : 'queued'
    case 'failed':
    case 'interrupted':
      return current ? 'failed' : 'notSent'
    // A file of it is missing or too large, and nothing says which: no row is singled out.
    default:
      return 'notSent'
  }
}

export interface UploadSummary {
  uploaded: number
  count: number
  /**
   * Whether Retry is worth offering. `unsendable` is a file gone or too large to send, which every
   * retry fails on.
   */
  retryable: boolean
}

export function uploadSummary(message: Message): UploadSummary {
  return {
    uploaded: message.attachments.filter((attachment) => attachment.uploaded).length,
    count: message.attachments.length,
    retryable: message.sendState === 'failed' || message.sendState === 'interrupted',
  }
}

/**
 * How far one file has got, in its own bytes: a report counts the encrypted bytes being moved, so
 * its fraction is spent against `sizeBytes`, as a download's is. Null where the size is unknown.
 */
export function uploadedBytes(
  attachment: Attachment,
  report: AttachmentTransferState | undefined,
): number | null {
  if (attachment.sizeBytes === undefined) return null
  if (attachment.uploaded || report?.state === 'done') return attachment.sizeBytes
  if (report?.state === 'running' && report.totalBytes > 0)
    return (attachment.sizeBytes * report.doneBytes) / report.totalBytes
  return 0
}

/**
 * How far a message's files have got together while it is uploading, in their own bytes summed
 * over every file, so the reading never goes backwards as one file hands over to the next.
 *
 * libsession records each file's size as the send stores it, so the total is known before the
 * first byte moves. `totalBytes` is 0 only where a size is missing, which is what indeterminate
 * means.
 */
export function uploadProgress(message: Message, uploads: MessageTransfers): TransferProgress {
  let done = 0
  let totalBytes = 0
  for (const attachment of message.attachments) {
    const progress = uploadedBytes(attachment, uploads[transferKey('upload', attachment.index)])
    if (progress === null || attachment.sizeBytes === undefined)
      return { doneBytes: 0, totalBytes: 0 }
    done += progress
    totalBytes += attachment.sizeBytes
  }
  // Rounded once, at the end, as a download set's is: a sum of fractions is not a byte count.
  return { doneBytes: Math.round(done), totalBytes }
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
