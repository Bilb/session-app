import { mediaKindOf } from '@session/basic-types'
import { requirePorts } from '@session/app'
import type { Attachment, AutoDownload, Message } from '@session/client'
import { tr } from '@session/localization'
import { useAttachmentTransfer, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { FileRow, type FileRowState, type FileRowThumbnail } from '@session/ui'
import { useState } from 'react'

import { fetchOf, type Fetch } from './attachmentFetch'
import { mayResolve } from './autoDownload'
import { formatBytes } from './formatBytes'
import { PENDING_COPY } from './pendingCopy'
import { exportOne } from './exportAttachment'
import { isViewable } from './viewableAttachments'

/**
 * One attachment on one message, as a row.
 *
 * Everything drawn is `FileRow`'s; everything said is this side of the boundary, because the
 * wording is the catalogue's and the transfers are the store's, and `@session/ui` can reach
 * neither. What is left here is the mapping between them.
 *
 * Nothing here knows whether the bytes are on this device, because nothing records it: asking for
 * them is the answer, and an attachment already in the cache is handed over at once with no
 * progress reported at all. So the row starts at "download" even for a file that is here, and the
 * tap that follows is instant.
 */
export function AttachmentRow({
  message,
  attachment,
  onFirstDownload,
  onOpen,
  autoDownload,
}: {
  message: Message
  attachment: Attachment
  /** The conversation has never been asked what to fetch unprompted. Asked once, on first tap. */
  onFirstDownload?: (() => void) | undefined
  /** Opens the viewer at this attachment. Absent on a row with no picture behind it. */
  onOpen?: (() => void) | undefined
  /** What this conversation fetches unasked. Undefined means nobody has been asked. */
  autoDownload?: AutoDownload | undefined
}) {
  const actions = useSessionActions()
  // The report is the live half; `attachment.availability` is the resting one. See `fetchOf`.
  const ref = { messageId: message.id, index: attachment.index }
  const report = useAttachmentTransfer('download', ref)
  const exporting = useAttachmentTransfer('export', ref)
  const [error, setError] = useState(false)

  const fetched = fetchOf(attachment, report)
  // A rejected call is this component's own knowledge and reaches no event, so it is the one
  // thing here that neither libsession nor a report can supply.
  const state: FileRowState = error && fetched.state === 'idle' ? 'failed' : fetched.state

  // A picture fetches itself as it draws: the url *is* the request, and the same call reads the
  // cache, joins a transfer already running, or starts one. Absent once expired, where asking
  // would only fail.
  const thumbnail: FileRowThumbnail | undefined =
    state === 'unavailable' || !isViewable(attachment)
      ? undefined
      : {
          // Left off where this is not ours to fetch: a url is the request, so handing one over
          // would spend the data the person was about to be asked about.
          ...(mayResolve(attachment, autoDownload)
            ? { uri: requirePorts().media.urlFor(ref) }
            : {}),
          kind: mediaKindOf(attachment.contentType),
          // Its own URL rather than pixels on the frame stream, so a placeholder reaches the
          // screen by the route a picture does. Null where the platform has no resolver.
          ...(attachment.hasPreview ? { preview: requirePorts().media.previewUrlFor(ref) } : {}),
        }

  function start(): void {
    setError(false)
    onFirstDownload?.()
    void actions.downloadAttachment(ref).catch(() => {
      setError(true)
    })
  }

  const act = state === 'ready' ? () => void exportOne(message, attachment.index, actions) : start

  return (
    <FileRow
      filename={attachment.filename ?? tr('attachment')}
      {...(attachment.contentType === undefined ? {} : { contentType: attachment.contentType })}
      {...(thumbnail === undefined ? {} : { thumbnail })}
      {...(thumbnail === undefined || onOpen === undefined ? {} : { onOpen })}
      caption={caption(attachment, state, fetched, exporting?.state === 'running')}
      state={state}
      // Absent while the server has not said how big the file is, which is what the first report
      // of every transfer means: an empty ring rather than a full one.
      {...(fetched.totalBytes > 0 ? { progress: fetched.doneBytes / fetched.totalBytes } : {})}
      {...(state === 'unavailable' || state === 'fetching'
        ? {}
        : { actionLabel: actionLabel(state), onAction: act })}
      testIDs={{
        row: ELEMENT.conversation.attachment,
        name: ELEMENT.conversation.attachmentName,
        caption: ELEMENT.conversation.attachmentState,
        thumbnail: ELEMENT.conversation.attachmentImage,
        // The id names what the control currently means rather than where it sits, which is the
        // only thing a test can ask about now that the two verbs share one button.
        action:
          state === 'ready'
            ? ELEMENT.conversation.attachmentExport
            : ELEMENT.conversation.attachmentDownload,
      }}
    />
  )
}

function caption(
  attachment: Attachment,
  state: FileRowState,
  fetched: Fetch,
  exporting: boolean,
): string {
  if (state === 'unavailable') return tr('attachmentsExpired')
  if (state === 'failed') return tr('failedToDownload')
  if (state === 'fetching') {
    // Indeterminate until the server says how big it is, which is what a total of 0 means.
    if (fetched.totalBytes === 0) return tr('downloading')
    return `${formatBytes(fetched.doneBytes)} / ${formatBytes(fetched.totalBytes)}`
  }
  if (exporting) return PENDING_COPY.exporting
  return attachment.sizeBytes === undefined ? '' : formatBytes(attachment.sizeBytes)
}

/**
 * What a screen reader announces the one control as. The glyph is what everyone else reads.
 *
 * Two verbs, and the state settles which with no further rule: Download moves bytes from the
 * network into the cache, Export writes a file we already hold out to a folder somebody chose.
 */
function actionLabel(state: FileRowState): string {
  if (state === 'failed') return tr('retry')
  return state === 'ready' ? PENDING_COPY.export : tr('download')
}
