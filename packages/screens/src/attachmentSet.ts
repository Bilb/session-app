import type { Attachment, Message } from '@session/client'
import type { AttachmentTransferState } from '@session/state'

import { fetchOf } from './attachmentFetch'

/**
 * What a message's attachments are collectively doing.
 *
 * `failed` beats `fetching`, because a set where one file is never coming cannot complete: a bar
 * that would stop short is a worse thing to draw than a retry.
 */
export type AttachmentSetState = 'ready' | 'fetching' | 'failed' | 'idle'

export interface AttachmentSet {
  state: AttachmentSetState
  /** How many attachments the message has, drawn or not. */
  count: number
  /** Plaintext bytes across the set, absent when any attachment did not declare its size. */
  sizeBytes?: number | undefined
  /**
   * How much of the whole set is here, in the same plaintext bytes `sizeBytes` counts.
   *
   * **Over every attachment, not over the ones currently moving**, so the reading never goes
   * backwards: a file that lands would otherwise leave both sums and shrink the set.
   *
   * A file already here counts as all of itself, so a set that was half cached starts half done.
   * A running one counts for its share, taken as the fraction its own report gives: that fraction
   * is computed from encrypted bytes, which is the only honest way to get it, and then applied to
   * the plaintext size so the two numbers on screen are in the same units as each other.
   *
   * `totalBytes` is 0 when any attachment declined to say how big it is, which is what
   * "indeterminate" means here - the same thing an absent `sizeBytes` means.
   */
  doneBytes: number
  totalBytes: number
  /** How many failed. The gallery draws the count; only the list can say which. */
  failed: number
}

/**
 * Folds a message's attachments and their transfers into one answer.
 *
 * **Over every attachment, not over the ones a gallery draws.** A message can carry 32 and an
 * album draws five, so a count taken from the visible tiles would be wrong in exactly the case
 * somebody needs it.
 */
export function summarise(
  message: Message,
  reportFor: (attachment: Attachment) => AttachmentTransferState | undefined,
): AttachmentSet {
  const attachments = message.attachments
  let size: number | undefined = 0
  let done = 0
  let failed = 0
  let running = 0
  let ready = 0
  let unavailable = 0

  for (const attachment of attachments) {
    if (attachment.sizeBytes === undefined || size === undefined) size = undefined
    else size += attachment.sizeBytes

    const fetch = fetchOf(attachment, reportFor(attachment))
    if (fetch.state === 'unavailable') unavailable += 1
    if (fetch.state === 'failed') failed += 1
    if (fetch.state === 'ready') {
      ready += 1
      done += attachment.sizeBytes ?? 0
    }
    if (fetch.state === 'fetching') {
      running += 1
      // The fraction comes from the encrypted figures because that is what is being moved; it is
      // then spent against the plaintext size, so `doneBytes` and `totalBytes` agree.
      const fraction = fetch.totalBytes > 0 ? fetch.doneBytes / fetch.totalBytes : 0
      done += (attachment.sizeBytes ?? 0) * fraction
    }
  }

  // Unavailable is excluded from what the set needs to resolve: an expired file cannot become
  // ready, and counting it against the total left a set with one expired file among others stuck
  // at idle forever. A set that is nothing but expired files has nothing to resolve and rests at
  // idle instead of a vacuous 'ready' - the footer already withholds Export unless count is 1, so
  // this never offers exporting the one file that arrived without going through the list.
  const resolvable = attachments.length - unavailable
  const state: AttachmentSetState =
    failed > 0
      ? 'failed'
      : running > 0
        ? 'fetching'
        : resolvable > 0 && ready === resolvable
          ? 'ready'
          : 'idle'

  return {
    state,
    count: attachments.length,
    sizeBytes: size,
    // Rounded once, at the end: a sum of fractions of byte counts is not a byte count, and a
    // display that formatted it would show a size nobody's file has.
    doneBytes: Math.round(done),
    totalBytes: size ?? 0,
    failed,
  }
}
