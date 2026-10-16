import type { PickedFile } from '@session/app'
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'
import { tr } from '@session/localization'

import { PENDING_COPY } from './pendingCopy'
import { sizeOf, type StagingRefusal } from './staging'

export interface RefusalNotice {
  kind: keyof StagingRefusal
  /** The suffix of its test ids. */
  id: 'unreadable' | 'size' | 'limit' | 'send'
  message: string
  detail?: string | undefined
}

/** The first refused file by name and size, and how many more there were. */
function tooLargeDetail(files: readonly PickedFile[]): string | undefined {
  const [first] = files
  if (first === undefined) return undefined
  const size = sizeOf(first)
  const named = size === undefined ? first.name : `${first.name} · ${size}`
  return files.length === 1 ? named : PENDING_COPY.attachmentNameAndMore(named, files.length - 1)
}

/** A notice for each thing the last pick, drop or send turned away, in the order they stack. */
export function refusalNotices({
  tooLarge,
  overLimit,
  unreadable,
  sendRefused,
}: StagingRefusal): RefusalNotice[] {
  const notices: RefusalNotice[] = []
  if (sendRefused !== 'none')
    notices.push({
      kind: 'sendRefused',
      id: 'send',
      message: tr(
        sendRefused === 'files' ? 'attachmentsErrorSending' : 'messageStatusFailedToSend',
      ),
    })
  if (unreadable > 0)
    notices.push({ kind: 'unreadable', id: 'unreadable', message: tr('attachmentsErrorLoad') })
  if (tooLarge.length > 0)
    notices.push({
      kind: 'tooLarge',
      id: 'size',
      message: tr('attachmentsErrorSize'),
      detail: tooLargeDetail(tooLarge),
    })
  if (overLimit > 0)
    notices.push({
      kind: 'overLimit',
      id: 'limit',
      message: PENDING_COPY.attachmentsErrorLimit(MAX_ATTACHMENTS_PER_MESSAGE),
      detail: PENDING_COPY.attachmentsNotAdded(overLimit),
    })
  return notices
}

/** A screen reader pauses at a sentence's end, not at a line break, which it reads as a space. */
const SENTENCE_END = /\p{Terminal_Punctuation}$/u

/**
 * Every notice as one thing to say: announced one by one, each would cut off the one before it.
 * A line apiece, stopped where the copy does not stop itself.
 */
export function refusalAnnouncement(notices: readonly RefusalNotice[]): string {
  return notices
    .flatMap(({ message, detail }) => (detail === undefined ? [message] : [message, detail]))
    .map((line) => (SENTENCE_END.test(line) ? line : `${line}.`))
    .join('\n')
}
