/**
 * How many picture urls are remembered as loaded: an album's or a file list's worth many times
 * over, and small enough that the oldest are dropped long before they cost anything.
 */
const REMEMBERED_URLS = 256

// Module scope: a render cache shared by every tile, not app state - no screen reads it, and it
// holds only which urls the platform has drawn, so a tile that remounts need not wait to be told.
const loaded = new Set<string>()

/** Whether a picture at `uri` has loaded in any tile, and has not failed since. */
export function wasLoaded(uri: string): boolean {
  return loaded.has(uri)
}

/** Remembers a load as the most recent, dropping the oldest past `REMEMBERED_URLS`. */
export function rememberLoaded(uri: string): void {
  loaded.delete(uri)
  loaded.add(uri)
  if (loaded.size <= REMEMBERED_URLS) return
  const oldest = loaded.values().next()
  if (oldest.done !== true) loaded.delete(oldest.value)
}

/** Forgets a picture whose url failed, whose bytes were evicted since it loaded. */
export function forgetLoaded(uri: string): void {
  loaded.delete(uri)
}
