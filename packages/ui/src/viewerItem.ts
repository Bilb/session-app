export type MediaViewerItem = {
  /** Null where this platform has no resolver for the bytes, which is a state, not a failure. */
  uri: string | null
  /** Drawn instead once `uri` fails to load, where there is one. */
  fallbackUri?: string | null | undefined
}

/** The first of an item's urls that has not failed, or null once none is left. */
export function drawnUri(item: MediaViewerItem, failed: readonly string[]): string | null {
  for (const uri of [item.uri, item.fallbackUri])
    if (uri != null && !failed.includes(uri)) return uri
  return null
}
