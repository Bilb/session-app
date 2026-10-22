import { PENDING_COPY, tr } from '@session/localization'

export type AttachmentVerb = 'download' | 'retry' | 'export' | 'open'

/** Functions, because `tr` reads the locale when it is called. */
const NAMES: Record<AttachmentVerb, () => string> = {
  download: () => tr('download'),
  retry: () => tr('retry'),
  open: () => tr('open'),
  export: () => PENDING_COPY.export,
}

export function verbName(verb: AttachmentVerb): string {
  return NAMES[verb]()
}

/** What a picture's press does in each transfer state, which is what a tile hints. */
export function pictureVerb(
  state: 'idle' | 'fetching' | 'ready' | 'failed' | 'unavailable',
): AttachmentVerb | null {
  switch (state) {
    case 'idle':
      return 'download'
    case 'failed':
      return 'retry'
    case 'ready':
      return 'open'
    case 'fetching':
    case 'unavailable':
      return null
  }
}
