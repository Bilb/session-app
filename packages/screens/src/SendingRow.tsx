import { formatBytes } from '@session/basic-types'
import { requirePorts } from '@session/app'
import type { Attachment, Message, TransferProgress } from '@session/client'
import { PENDING_COPY, tr } from '@session/localization'
import {
  transferKey,
  useMessageTransfers,
  useSessionActions,
  type AttachmentTransferState,
} from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { FileRow, type FileRowState, type FileRowThumbnail } from '@session/ui'

import { fetchOf } from './attachmentFetch'
import { uploadStateOf, type UploadState } from './uploadState'
import { leadUri, leadsWithPicture } from './viewableAttachments'

const ROW_STATE: Record<UploadState, FileRowState> = {
  uploaded: 'uploaded',
  // The held ring, filled as the upload's reports say.
  uploading: 'fetching',
  queued: 'queued',
  failed: 'failed',
  notSent: 'unsent',
}

/** The file's own upload while it is running and its size is known, as a download's row has. */
function running(
  state: UploadState,
  report: AttachmentTransferState | undefined,
): TransferProgress | undefined {
  return state === 'uploading' && report?.state === 'running' && report.totalBytes > 0
    ? report
    : undefined
}

function caption(
  attachment: Attachment,
  state: UploadState,
  progress: TransferProgress | undefined,
): string {
  switch (state) {
    case 'uploaded':
      return attachment.sizeBytes === undefined ? '' : formatBytes(attachment.sizeBytes)
    case 'uploading':
      // A word until the report says how big the file is, as a download's row says one.
      return progress === undefined
        ? tr('uploading')
        : `${formatBytes(progress.doneBytes)} / ${formatBytes(progress.totalBytes)}`
    case 'queued':
      return PENDING_COPY.attachmentQueued
    case 'failed':
      return tr('messageStatusFailedToSend')
    case 'notSent':
      return PENDING_COPY.attachmentNotSent
  }
}

/**
 * One file of a message we are sending, until the whole set is on the file server.
 *
 * **Retry on the failed row is the message's retry.** libsession resumes a message rather than a
 * file: it uploads again from the first file without a URL, which is this one, and keeps the rest.
 */
export function SendingRow({
  message,
  attachment,
  onAccent,
  hasControl,
}: {
  message: Message
  attachment: Attachment
  onAccent?: boolean | undefined
  /** False for a message's one file, whose footer carries the message's retry. */
  hasControl?: boolean | undefined
}) {
  const actions = useSessionActions()
  const uploads = useMessageTransfers(message.id)
  const upload = uploadStateOf(message, attachment.index, uploads)
  const progress = running(upload, uploads[transferKey('upload', attachment.index)])
  const ref = { messageId: message.id, index: attachment.index }
  // libsession keeps a thumbnail of what we send, so a picture leads with it here too.
  const thumbnail: FileRowThumbnail | undefined = leadsWithPicture(attachment)
    ? {
        uri: leadUri(message.id, attachment, fetchOf(attachment).state),
        fetchesOnOpen: false,
        thumbhash: attachment.hasThumbhash ? requirePorts().media.thumbhashUrlFor(ref) : undefined,
      }
    : undefined
  const retry =
    upload === 'failed'
      ? () => {
          void actions.retry(message.id)
        }
      : undefined

  return (
    <FileRow
      filename={attachment.filename ?? tr('attachment')}
      contentType={attachment.contentType}
      thumbnail={thumbnail}
      caption={caption(attachment, upload, progress)}
      state={ROW_STATE[upload]}
      progress={progress === undefined ? undefined : progress.doneBytes / progress.totalBytes}
      actionLabel={
        upload === 'uploading' ? tr('uploading') : retry === undefined ? undefined : tr('retry')
      }
      onAction={retry}
      onAccent={onAccent}
      hasControl={hasControl}
      testIDs={{
        row: ELEMENT.conversation.attachment,
        name: ELEMENT.conversation.attachmentName,
        caption: ELEMENT.conversation.attachmentState,
        lead: ELEMENT.conversation.attachmentLead,
        thumbnail: ELEMENT.conversation.attachmentImage,
        action: ELEMENT.conversation.attachmentRetry,
      }}
    />
  )
}
