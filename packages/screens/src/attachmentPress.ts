import { PENDING_COPY, tr } from '@session/localization'
import type { FileRowState } from '@session/ui'

import type { ViewerFit } from './viewableAttachments'

/**
 * What a press on one attachment row does.
 *
 * Download moves bytes from the network into the cache, Export writes a file we already hold out to
 * a folder somebody chose, and Open shows it in the viewer.
 */
export type AttachmentVerb = 'download' | 'retry' | 'export' | 'open'

/** The trailing control's verb, which the state settles with no further rule. */
export function controlVerb(state: FileRowState): AttachmentVerb | null {
  switch (state) {
    case 'idle':
      return 'download'
    case 'failed':
      return 'retry'
    case 'ready':
      return 'export'
    case 'fetching':
    case 'unavailable':
    case 'queued':
    case 'uploaded':
    case 'unsent':
      return null
  }
}

/**
 * The row's verb: a picture the viewer shows opens once it is here, as its lead square does, and
 * the control stays the way to export it. One awaiting its rendition opens too, and the viewer asks
 * for it. Anything else does what the control offers.
 */
export function rowVerb(state: FileRowState, fit: ViewerFit): AttachmentVerb | null {
  if (state !== 'ready') return controlVerb(state)
  switch (fit) {
    case 'opens':
    case 'awaitsRendition':
      return 'open'
    case 'exports':
      return controlVerb(state)
  }
}

/** What a screen reader announces a press as. The glyph is what everyone else reads. */
export function verbLabel(verb: AttachmentVerb): string {
  switch (verb) {
    case 'download':
      return tr('download')
    case 'retry':
      return tr('retry')
    case 'export':
      return PENDING_COPY.export
    case 'open':
      return tr('open')
  }
}
