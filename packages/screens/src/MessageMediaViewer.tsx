import { mediaKindOf } from '@session/basic-types'
import { requirePorts } from '@session/app'
import type { Message } from '@session/client'
import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { MediaViewer, type MediaViewerItem } from '@session/ui'
import { useRef } from 'react'

import { exportOne } from './exportAttachment'
import { PENDING_COPY } from './pendingCopy'
import { viewableAttachments } from './viewableAttachments'

/**
 * The viewer, wired to one message.
 *
 * `MediaViewer` knows nothing about messages or ports: it takes resolved urls and worded labels,
 * because `@session/ui` reaches neither the catalogue nor `requirePorts`. Everything that has to
 * ask something is here.
 */
export function MessageMediaViewer({
  message,
  index,
  onIndex,
  onClose,
}: {
  message: Message
  /** Null when nothing is open, so the caller holds one piece of state rather than two. */
  index: number | null
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const actions = useSessionActions()
  const viewable = viewableAttachments(message)

  const items: MediaViewerItem[] = viewable.map((attachment) => ({
    // Null where the platform has no resolver. The viewer says so rather than drawing a broken
    // picture, which is the one thing it must not do with somebody's photograph.
    uri: requirePorts().media.urlFor({ messageId: message.id, index: attachment.index }),
    kind: mediaKindOf(attachment.contentType),
  }))

  // Held past closing, so the fade-out plays over the picture that was open rather than the first.
  const lastIndex = useRef(0)
  if (index !== null) lastIndex.current = index
  const at = index ?? lastIndex.current
  const attachment = viewable[at]

  return (
    <MediaViewer
      open={index !== null}
      items={items}
      index={at}
      onIndex={onIndex}
      onClose={onClose}
      onExport={() => {
        if (attachment !== undefined) void exportOne(message, attachment.index, actions)
      }}
      // Nothing behind it yet: the row's own menu is where these live, and a second copy of it
      // belongs with that work rather than ahead of it.
      onMore={() => undefined}
      positionLabel={`${String(at + 1)} / ${String(items.length)}`}
      unavailableLabel={tr('attachmentsErrorNotSupported')}
      closeLabel={tr('close')}
      exportLabel={PENDING_COPY.export}
      moreLabel={tr('openMessageContextMenu')}
      previousLabel={PENDING_COPY.previous}
      nextLabel={tr('next')}
      testID={ELEMENT.conversation.mediaViewer}
      closeTestID={ELEMENT.conversation.mediaViewerClose}
    />
  )
}
