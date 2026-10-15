/** libsession takes a filesystem path; both pickers hand back a `file://` URL of their copy. */
export function pathOf(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

/** Per segment, because a name may hold `#` or `%`, which a URL would read as syntax. */
export function fileUrl(path: string): string {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`
}

/** A picked file's name where the picker gave none: the last segment of its copy. */
export function lastSegment(uri: string): string {
  return decodeURIComponent(uri.split('/').pop() ?? '')
}
