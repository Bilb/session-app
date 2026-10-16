import { randomUUID } from 'expo-crypto'
import { plainPath } from './layout'
import { File, moveInto, removeIfPresent, stagedDirectory, type Directory } from './roots'

const stagedRoot = (): string => plainPath(stagedDirectory().uri).replace(/\/+$/, '') + '/'

/** Moves a picker's copy into the staged root under a name of its own; returns its path. */
export function keepPicked(uri: string, name: string): string {
  const target = new File(stagedDirectory(), `${randomUUID()}-${name}`)
  moveInto(new File(uri), target)
  return plainPath(target.uri)
}

/** Deletes a staged copy. Only our own: a path anywhere else is not one this app made. */
export function discardStaged(path: string): void {
  if (!path.startsWith(stagedRoot())) return
  try {
    removeIfPresent(path)
  } catch {
    // Already gone.
  }
}

/**
 * Deletes every staged copy a previous run left behind: a run killed with files in the tray
 * leaves them, and nothing else would.
 */
// TODO: once messages with attachments are sent, keep what a message not yet uploaded holds.
export function sweepStaged(): void {
  // What is in the root, not the root: the native module made and protected that at launch.
  let entries: ReturnType<Directory['list']>
  try {
    entries = stagedDirectory().list()
  } catch {
    // Run at load: a root that cannot be read must not keep the app from starting.
    return
  }
  for (const entry of entries) {
    try {
      entry.delete()
    } catch {
      // Gone already, or the next launch's to sweep.
    }
  }
}
