import type { Message } from '@session/client'
import { useSessionActions } from '@session/state'

import { PENDING_COPY } from '@session/localization'
import type { AttachmentSet } from './attachmentSet'
import { isUploadPhase, uploadSummary } from './uploadState'

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
  sending: { caption: string; retryable: boolean } | undefined
} {
  const actions = useSessionActions()
  if (!isUploadPhase(message)) return { set, onAction: act, sending: undefined }
  const summary = uploadSummary(message)
  return {
    set,
    onAction: () => {
      void actions.retry(message.id)
    },
    sending: {
      caption: PENDING_COPY.attachmentsUploaded(summary.uploaded, summary.count),
      retryable: summary.retryable,
    },
  }
}
