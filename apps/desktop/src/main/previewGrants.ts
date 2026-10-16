import { stagedThumbnailUrl } from '@session/app/mediaUrl'

/** How many staged files may have a preview at once: a message takes 32, so a few in flight. */
const MAX_GRANTS = 128

/**
 * Which local files the media scheme may make a staged thumbnail of: only those the preload
 * resolved from a `File` the person picked or dropped.
 *
 * Without it any page script could ask for `staged/<any path>`, and learn from the image loading or
 * failing whether a file exists and is a picture, or on Windows make main open a share across the
 * network. A `File` with a path cannot be forged: one the page builds itself has none.
 *
 * Exact path strings, oldest forgotten first, never persisted. Pure, so it is tested without
 * Electron.
 */
export class PreviewGrants {
  private readonly granted = new Set<string>()

  /** The url to draw `path` by, granted, or null for a path the scheme cannot carry. */
  grant(path: unknown): string | null {
    if (typeof path !== 'string') return null
    const url = stagedThumbnailUrl(path)
    if (url === null) return null
    this.granted.delete(path)
    this.granted.add(path)
    for (const oldest of this.granted) {
      if (this.granted.size <= MAX_GRANTS) break
      this.granted.delete(oldest)
    }
    return url
  }

  allows(path: string): boolean {
    return this.granted.has(path)
  }
}
