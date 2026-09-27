import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Named imports do not survive the ESM loader here; see the note in index.ts.
import electron from 'electron'

const { BrowserWindow, dialog, ipcMain, shell } = electron

/**
 * Folders the person has pointed at in a save dialog this run.
 *
 * What makes `reveal` safe to expose at all. It hands a path to the operating system, and the
 * renderer is not trusted to have checked one -- the same standard `open-external` holds itself
 * to. A path is allowed only if it sits in a folder somebody chose here, which is the one way a
 * folder gets into this set.
 *
 * By folder rather than by exact path because the path that comes back is not the path that went
 * out: a save that collides becomes `name (2)`, so an allowlist of the strings this handed over
 * would refuse exactly the file it had just written.
 *
 * Not persisted. A folder chosen last week is not something this run has any reason to reach.
 */
const chosen = new Set<string>()

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
  if (typeof path !== 'string' || path.length === 0) return false
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
  if (typeof name !== 'string') return FALLBACK_SUGGESTED_NAME
  const bare = name
    .slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1)
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return bare === '' || bare === '.' || bare === '..' ? FALLBACK_SUGGESTED_NAME : bare
}

/**
 * Choosing where a file goes, and showing somebody where it went.
 *
 * In main because that is where Electron's `dialog` and `shell` are, and because deciding what
 * the renderer may reach is not a decision the renderer can be trusted with.
 */
export function serveFiles(): void {
  ipcMain.handle('files:choose-export-location', async (event, suggested: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const name = sanitiseSuggestedName(suggested)
    // Modal to the window that asked rather than to the app: a second window is not blocked by a
    // save dialog it did not open.
    const answer = await (window
      ? dialog.showSaveDialog(window, { defaultPath: name })
      : dialog.showSaveDialog({ defaultPath: name }))
    if (answer.canceled || answer.filePath === '') return null
    chosen.add(dirname(answer.filePath))
    return answer.filePath
  })

  ipcMain.handle('files:reveal', (_event, path: unknown): boolean => {
    if (!isInChosenFolder(path, chosen)) return false
    shell.showItemInFolder(path)
    return true
  })
}
