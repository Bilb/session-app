/** The preview a staged tile still draws: none once its url has failed, so the face stays. */
export function stagedPreview(
  previewUrl: string | undefined,
  failedUrl: string | null,
): string | undefined {
  return previewUrl === failedUrl ? undefined : previewUrl
}
