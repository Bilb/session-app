import { Directory, File, Paths } from 'expo-file-system'

import { fileUri } from './layout'

/**
 * The dev photographs, by file name, to their `file://` urls. In Documents rather than a root
 * because `fake-media:push` copies them there from the host; dev builds only.
 */
export function pushedPhotos(): Map<string, string> {
  const folder = new Directory(Paths.document, 'fake-media')
  const photos = new Map<string, string>()
  if (folder.exists) {
    for (const entry of folder.list()) {
      if (entry instanceof File) photos.set(entry.name, entry.uri)
    }
  }
  return photos
}

/** Writes what the fake exported at `path`: a copy of a dev photograph, or the bytes it made. */
export function writeFakeExport(
  path: string,
  source: { photo: string } | { text: Uint8Array },
): void {
  const target = new File(fileUri(path))
  if ('photo' in source) new File(source.photo).copySync(target)
  else target.write(source.text)
}
