import { ELEMENT } from '@session/test-ids'

import type { Expected } from './node'

export const ALBUM_TILE_ID = ELEMENT.conversation.attachmentTile
export const ALBUM_PICTURE_ID = ELEMENT.conversation.attachmentImage

/**
 * One tile of an album: a button while its press does something or a transfer holds it, and a
 * picture otherwise. Held, it stays a stop so focus on it is not dropped.
 */
export function albumTile({
  name,
  hint,
  transferring = false,
}: {
  name: string
  /** What its press does; absent while the press does nothing. */
  hint?: string | undefined
  transferring?: boolean | undefined
}): Expected {
  const button = transferring || hint !== undefined
  const node = {
    role: button ? 'button' : 'image',
    name,
    hint: hint ?? null,
    disabled: transferring,
  } as const
  // On native every tile is an accessibility element, or iOS would read the picture inside it.
  return { desktop: { ...node, focusable: button }, native: { ...node, focusable: true } }
}
