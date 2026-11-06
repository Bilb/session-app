import { formatBytes } from '@session/basic-types'
import type { Message, TransferProgress } from '@session/client'
import { isolate, PENDING_COPY, tr } from '@session/localization'
import { useMessageTransfers, useSessionActions } from '@session/state'

import type { AttachmentSet } from './attachmentSet'
import { isUploadPhase, uploadProgress, uploadSummary } from './uploadState'

/** What the footer says and draws while our message's files are the story. */
export interface SendingFooter {
  caption: string
  retryable: boolean
  /** The set's upload while the message is `uploading`, drawn as a ring in the verb's place. */
  uploading: TransferProgress | undefined
}

/**
 * Bytes while the upload runs, as a download's footer reads, and a word until every file's size is
 * known. Once it has stopped, the count, which says how far it got.
 */
function sendingCaption(message: Message, uploading: TransferProgress | undefined): string {
  if (uploading === undefined) {
    const summary = uploadSummary(message)
    return PENDING_COPY.attachmentsUploaded(summary.uploaded, summary.count)
  }
  if (uploading.totalBytes === 0) return tr('uploading')
  const done = isolate(formatBytes(uploading.doneBytes))
  return `${done} / ${isolate(formatBytes(uploading.totalBytes))}`
}

/**
 * What a set's footer says and does, the same in the transcript and in the sheet.
 *
 * While our files are uploading, the line is the upload's and its verb is the message's retry;
 * otherwise it is the download's.
 */
export function useAttachmentFooter(
  message: Message,
  { set, act }: { set: AttachmentSet; act: () => void },
): {
  set: AttachmentSet
  onAction: () => void
  sending: SendingFooter | undefined
} {
  const actions = useSessionActions()
  const uploads = useMessageTransfers(message.id)
  if (!isUploadPhase(message)) return { set, onAction: act, sending: undefined }
  const uploading = message.sendState === 'uploading' ? uploadProgress(message, uploads) : undefined
  return {
    set,
    onAction: () => {
      void actions.retry(message.id)
    },
    sending: {
      caption: sendingCaption(message, uploading),
      retryable: uploadSummary(message).retryable,
      uploading,
    },
  }
}
