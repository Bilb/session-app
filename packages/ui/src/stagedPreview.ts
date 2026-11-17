/** What a staged tile has heard of its thumbnail: the url that last loaded, and one that failed. */
export interface StagedPreviewState {
  loaded: string | null
  failed: string | null
}

export const NOTHING_HEARD: StagedPreviewState = { loaded: null, failed: null }

/**
 * The thumbnail a tile draws over its document face, and whether it shows yet.
 *
 * None once its url has failed, so a file that does not decode reads as the document it is; drawn
 * but hidden until it loads, so a picture still being made shows the face rather than a blank.
 */
export function stagedPreview(
  previewUrl: string | undefined,
  { loaded, failed }: StagedPreviewState,
): { url: string | undefined; shown: boolean } {
  const url = previewUrl === failed ? undefined : previewUrl
  return { url, shown: url !== undefined && url === loaded }
}

export function previewLoaded(state: StagedPreviewState, url: string): StagedPreviewState {
  return { ...state, loaded: url }
}

export function previewFailed(state: StagedPreviewState, url: string): StagedPreviewState {
  return { ...state, failed: url }
}
