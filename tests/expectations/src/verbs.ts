import { tr } from '@session/localization'

/** The attachment verbs whose word is in the catalogue. Export's is not yet: callers supply it. */
export type CatalogueVerb = 'download' | 'retry' | 'open'

export function verbName(verb: CatalogueVerb): string {
  return tr(verb)
}

/** What a picture's press does in each transfer state, which is what a tile hints. */
export function pictureVerb(
  state: 'idle' | 'fetching' | 'ready' | 'failed' | 'unavailable',
): CatalogueVerb | null {
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
