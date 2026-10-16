import { randomUUID } from 'node:crypto'

import { MEDIA_SCHEME } from '@session/app/mediaUrl'
import { isStagedPath } from '@session/basic-types/stagedPath'

/** A ceiling, not a working set: grants are revoked as the composer lets go of what it staged. */
const MAX_GRANTS = 128

const PICKED = `${MEDIA_SCHEME}://picked/`

/**
 * Which local files the media scheme may make a staged thumbnail of: only those the preload
 * resolved from a `File` the person picked or dropped, each under a url of its own.
 *
 * Without it any page script could ask for a thumbnail of any path, and learn from the image
 * loading or failing whether a file exists and is a picture, or on Windows make main open a share
 * across the network. A `File` with a path cannot be forged: one the page builds itself has none.
 * The url names a grant rather than the path, so the page never chooses what main opens, and a
 * file picked again after it changed is a new url rather than the picture Chromium cached.
 *
 * Oldest forgotten first, never persisted. Pure, so it is tested without Electron.
 */
export class PreviewGrants {
  private readonly granted = new Map<string, string>()

  /** The url to draw `path` by, granted, or null for a path the scheme refuses. */
  grant(path: unknown): string | null {
    if (typeof path !== 'string' || !isStagedPath(path)) return null
    const token = randomUUID().replaceAll('-', '')
    this.granted.set(token, path)
    for (const oldest of this.granted.keys()) {
      if (this.granted.size <= MAX_GRANTS) break
      this.granted.delete(oldest)
    }
    return `${PICKED}${token}`
  }

  /** Forgets the grant behind `url`; anything else is ignored. */
  revoke(url: unknown): void {
    if (typeof url === 'string' && url.startsWith(PICKED))
      this.granted.delete(url.slice(PICKED.length))
  }

  /** Whether `url` is one of these, granted or not, which main answers itself. */
  names(url: string): boolean {
    return url.startsWith(PICKED)
  }

  /** The path behind a granted url, or null. */
  pathFor(url: string): string | null {
    if (!url.startsWith(PICKED)) return null
    return this.granted.get(url.slice(PICKED.length)) ?? null
  }
}
