import type { Message } from '@session/client'
import { albumLayout } from '@session/ui'

import { albumAspect } from './albumAspect'
import type { AlbumGeometry } from './albumSize'
import { FOOTER_MIN_WIDTH_PX } from './AttachmentFooter'
import { attachmentView } from './attachmentView'
import { isViewable } from './viewableAttachments'

/**
 * How wide a message's attachments, and the footer under them, are drawn.
 *
 * The album's width, except for one picture the layout draws narrower - a phone screenshot - where
 * it is that picture's width, so the bubble shrinks to it rather than leaving it at the start of
 * an album-wide bubble; but never narrower than the footer can be drawn. A list keeps the album's
 * width whatever it holds.
 */
export function attachmentsWidthPx(message: Message, geometry: AlbumGeometry): number {
  if (attachmentView(message) !== 'gallery') return geometry.widthPx
  const viewable = message.attachments.filter(isViewable)
  const lone = viewable.length === 1 ? viewable[0] : undefined
  if (lone === undefined) return geometry.widthPx
  const drawn = albumLayout([albumAspect(lone)], geometry.widthPx, {
    loneMaxHeightPx: geometry.loneMaxHeightPx,
  }).width
  return Math.min(geometry.widthPx, Math.max(drawn, FOOTER_MIN_WIDTH_PX))
}
