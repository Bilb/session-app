import { randomUUID } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'

import { fileUri, plainPath } from './layout'

/**
 * Where staged copies live: under documents, not the cache the pickers write to, because the OS
 * may empty a cache and libsession reads a file only when its upload's turn comes.
 */
const STAGED = new Directory(Paths.document, 'staged-attachments')
const STAGED_ROOT = plainPath(STAGED.uri).replace(/\/+$/, '') + '/'

/** Moves a picker's copy into the staged folder under a name of its own; returns its path. */
export async function keepPicked(uri: string, name: string): Promise<string> {
  if (!STAGED.exists) STAGED.create({ intermediates: true, idempotent: true })
  const target = new File(STAGED, `${randomUUID()}-${name}`)
  await new File(uri).move(target)
  return plainPath(target.uri)
}

/** Deletes a staged copy. Only our own: a path anywhere else is not one this app made. */
export function discardStaged(path: string): void {
  if (!path.startsWith(STAGED_ROOT)) return
  try {
    new File(fileUri(path)).delete()
  } catch {
    // Already gone.
  }
}
