/** A picked file's name where the picker gave none: the last segment of its copy. */
export function lastSegment(uri: string): string {
  return decodeURIComponent(uri.split('/').pop() ?? '')
}
