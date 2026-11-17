import { Directory, File, Paths } from 'expo-file-system'

import type { ExportSource } from '../dev/fakeMedia'
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

/** The bytes of a dev photograph, by the url `pushedPhotos` gave. */
export async function readPushedPhoto(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await new File(uri).arrayBuffer())
}

/**
 * The first `count` bytes of a staged file and its size. A picker's copy in the app's own folder
 * is the only thing staged, so `exists`, false for anything but a file, is the shim's regular-file
 * check.
 */
export function readStagedHead(
  path: string,
  count: number,
): Promise<{ head: Uint8Array; size: number }> {
  const file = new File(fileUri(path))
  if (!file.exists) return Promise.reject(new Error('not a regular file'))
  const handle = file.open()
  try {
    const size = handle.size ?? file.size
    return Promise.resolve({ head: handle.readBytesSync(Math.min(count, size)), size })
  } finally {
    handle.close()
  }
}

/** Writes what the fake exported at `path`: a copy of a dev photograph, or the bytes it made. */
export function writeFakeExport(path: string, source: ExportSource): void {
  const target = new File(fileUri(path))
  if ('photo' in source) new File(source.photo).copySync(target)
  else target.writeSync(source.text)
}
