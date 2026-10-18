import type { Message } from '@session/client'

import { isViewable } from './viewableAttachments'

export type AttachmentView = 'gallery' | 'list'

/**
 * Whether the reader gets to choose the shape.
 *
 * A plain file makes the gallery impossible, not unwanted. libsession says which messages can be
 * a gallery, and its whitelist takes AVIF and `image/pjpeg`, which the viewer here cannot open, so
 * each one must also be viewable. The list can hold any set, which is why this asks about the
 * gallery.
 */
export function canChooseView(message: Message): boolean {
  // TODO: draw a video as a tile once libsession has a still for it and galleryViewable admits it.
  return message.galleryViewable && message.attachments.every(isViewable)
}

/**
 * Which shape a message's attachments take.
 *
 * **One plain file puts the whole set in a list**, pictures included. The alternative is a gallery
 * with the documents hanging off the bottom of it, which draws one message as two objects and
 * leaves the reader to work out that they are one.
 *
 * The list is also the only shape with room for a per-item state, a per-item control and a
 * per-item retry - and libsession has been reporting per `(message_id, index)` all along. A set
 * that cannot be drawn as a gallery is exactly the set most likely to need them.
 *
 * Otherwise it is libsession's stored `gallery`, which starts on wherever a gallery is possible.
 * Where libsession says gallery and this client cannot draw one, the list wins and the stored
 * value is left alone, so a client that can draw the set still shows it as one.
 */
export function attachmentView(message: Message): AttachmentView {
  return canChooseView(message) && message.gallery ? 'gallery' : 'list'
}
