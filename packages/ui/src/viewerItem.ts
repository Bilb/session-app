export type MediaViewerItem = {
  /** Null where this platform has no resolver for the bytes, which is a state, not a failure. */
  uri: string | null
  /** Drawn instead once `uri` fails to load, where there is one. */
  fallbackUri?: string | null | undefined
  /**
   * Where `uri` is null because the picture is still being made: a url loaded out of sight, whose
   * request is what asks for it. The caller swaps in an item with a `uri` once it exists.
   */
  preparing?: string | null | undefined
  /** Known not to draw: what it needed will never be made. Shown as a picture that failed. */
  failed?: boolean | undefined
}

/** The first of an item's urls that has not failed, or null once none is left. */
export function drawnUri(item: MediaViewerItem, failed: readonly string[]): string | null {
  for (const uri of [item.uri, item.fallbackUri])
    if (uri != null && !failed.includes(uri)) return uri
  return null
}
