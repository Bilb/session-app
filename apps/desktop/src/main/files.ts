import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Named imports do not survive the ESM loader here; see the note in index.ts.
import electron from 'electron'

import type { BrowserWindow } from 'electron'

import { isFromAppFrame } from './security'

const { dialog, shell } = electron

/** Linux's PATH_MAX. */
export const MAX_PATH_CHARS = 4096

/** The file-name limit on ext4, APFS and NTFS. */
export const MAX_SUGGESTED_NAME_CHARS = 255

// Resolved and, where it exists, symlink-followed, so a folder cannot read as contained by
// pointing somewhere else -- a folder not created yet has nothing to follow and compares as given.
function folderKey(folder: string, caseInsensitive: boolean): string {
  const resolved = resolve(folder)
  const real = (() => {
    try {
      return realpathSync(resolved)
    } catch {
      return resolved
    }
  })()
  return caseInsensitive ? real.toLowerCase() : real
}

/**
 * Whether a path sits in one of the folders somebody pointed at.
 *
 * Pure and exported so it can be tested without an Electron process: it is the whole of the rule
 * that decides what the renderer may hand to the operating system, and a rule that can only be
 * exercised by launching an app is one nobody exercises.
 */
export function isInChosenFolder(
  path: unknown,
  folders: ReadonlySet<string>,
  caseInsensitive = process.platform === 'win32',
): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_CHARS) return false
  const folder = folderKey(dirname(path), caseInsensitive)
  return [...folders].some((chosenFolder) => folderKey(chosenFolder, caseInsensitive) === folder)
}

const FALLBACK_SUGGESTED_NAME = 'attachment'

/**
 * The file name to pre-fill a save dialog with, from a name the sender of the attachment chose.
 *
 * Only ever a bare name: a directory part, absolute or `..`, would pre-point the dialog at a
 * folder the sender picked, one Enter away from writing there. Both separators are stripped
 * whatever the platform, since the sender's platform is not this one.
 */
export function sanitiseSuggestedName(name: unknown): string {
  if (typeof name !== 'string' || name.length > MAX_SUGGESTED_NAME_CHARS) {
    return FALLBACK_SUGGESTED_NAME
  }
  const bare = name
    .slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1)
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return bare === '' || bare === '.' || bare === '..' ? FALLBACK_SUGGESTED_NAME : bare
}

/** What the window's other handlers need to know about the folders chosen in it. */
export interface ServedFiles {
  /**
   * Whether the renderer may have an attachment written to this path.
   *
   * The bridge command that writes one takes whatever destination the request carries and has no
   * containment check of its own -- this is the one place that sees every such request before it
   * reaches the native write, so it is the whole of the check.
   */
  mayExportTo(destination: unknown): boolean
}

/**
 * Choosing where a file goes, and showing somebody where it went, for one window.
 *
 * In main because that is where Electron's `dialog` and `shell` are, and because deciding what
 * the renderer may reach is not a decision the renderer can be trusted with.
 */
export function serveFiles(window: BrowserWindow, appUrl: string): ServedFiles {
  /**
   * Folders the person has pointed at in a save dialog of this window, this run.
   *
   * What makes `reveal` and `exportAttachment` safe to expose at all. Both hand a path to an
   * operation the renderer cannot be trusted to have checked -- the same standard `open-external`
   * holds itself to. A path is allowed only if it sits in a folder somebody chose here, which is
   * the one way a folder gets into this set.
   *
   * By folder rather than by exact path because the path that comes back is not the path that
   * went out: a save that collides becomes `name (2)`, so an allowlist of the strings this handed
   * over would refuse exactly the file it had just written.
   *
   * Not persisted, and not shared with another window: neither has any reason to reach a folder
   * somebody chose elsewhere.
   */
  const chosen = new Set<string>()
  const { ipc } = window.webContents

  ipc.handle('files:choose-export-location', async (event, suggested: unknown) => {
    if (!isFromAppFrame(event.senderFrame, appUrl)) return null
    // Modal to this window rather than to the app: a second window is not blocked by a save
    // dialog it did not open.
    const answer = await dialog.showSaveDialog(window, {
      defaultPath: sanitiseSuggestedName(suggested),
    })
    if (answer.canceled || answer.filePath === '') return null
    chosen.add(dirname(answer.filePath))
    return answer.filePath
  })

  ipc.handle('files:reveal', (event, path: unknown): boolean => {
    if (!isFromAppFrame(event.senderFrame, appUrl) || !isInChosenFolder(path, chosen)) return false
    shell.showItemInFolder(path)
    return true
  })

  return { mayExportTo: (destination) => isInChosenFolder(destination, chosen) }
}
