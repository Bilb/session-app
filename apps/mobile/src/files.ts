import type { FilesPort } from '@session/app'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import { Linking, Platform } from 'react-native'

import {
  exportFileName,
  folderDocumentUri,
  isGrantedFolderUri,
  photoLibraryExtension,
  placeUnderFreeName,
  stagedPath,
  StagedExports,
} from './exportPaths'

/**
 * Where an export goes once libsession has written it: the photo library, or a folder somebody
 * picked. Neither is a path libsession could write to, so the file is staged first.
 */
type Delivery = { to: 'photos' } | { to: 'folder'; folder: Directory }

// libsession takes filesystem paths and expo-file-system takes URLs, as in storage.ts.
const cacheRoot = Paths.cache.uri.replace(/^file:\/\//, '').replace(/\/+$/, '')
const EXPORT_ROOT = `${cacheRoot}/session-exports`

const staged = new StagedExports<Delivery>(EXPORT_ROOT)

// Per segment, because a sender's name may hold `#` or `%`, which a URL would read as syntax.
function fileUrl(path: string): string {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`
}

function removeStaging(token: string): void {
  try {
    new Directory(fileUrl(`${EXPORT_ROOT}/${token}`)).delete()
  } catch {
    // Already gone, or never made; the sweep at the next launch has the same job.
  }
}

/**
 * Deletes every staged export a previous run left behind.
 *
 * A staged file is the attachment decrypted, outside libsession's encrypted cache, so none may
 * outlive the export it was made for.
 */
export function sweepStagedExports(): void {
  try {
    const root = new Directory(fileUrl(EXPORT_ROOT))
    if (root.exists) root.delete()
  } catch {
    // Nothing to sweep is the common case.
  }
}

/**
 * Whether an `exportAttachment` destination is one this port handed out and nothing has written
 * to, spending it.
 *
 * The check desktop's main process makes before a request reaches the native write: that
 * command writes anywhere, and the name in the path came from the sender.
 */
export function mayExportTo(destination: unknown): boolean {
  return staged.admit(destination)
}

/**
 * The folder somebody picked for files last time, on Android.
 *
 * The picker's grant is persistable, and asking for a folder on every export put Android's "Allow
 * access" prompt in front of each one. iOS hands out a security-scoped URL that does not outlive
 * the pick, so it asks every time and has no prompt to repeat.
 */
const rememberedFolder = new File(Paths.document, 'export-folder')

// Android 11 and up refuse to grant the Download folder itself to a picker, so the first pick
// starts one that can be granted.
const FIRST_PICK_TREE =
  'content://com.android.externalstorage.documents/document/primary%3ADocuments'

function recalledFolder(): Directory | null {
  if (Platform.OS !== 'android') return null
  try {
    if (!rememberedFolder.exists) return null
    const uri = rememberedFolder.textSync().trim()
    if (!isGrantedFolderUri(uri)) return null
    const folder = new Directory(uri)
    return folder.exists ? folder : null
  } catch {
    // A revoked grant reads as a folder that is not there, and the picker asks again.
    return null
  }
}

function remember(folder: Directory | null): void {
  if (Platform.OS !== 'android') return
  try {
    if (folder !== null) rememberedFolder.write(folder.uri)
    else if (rememberedFolder.exists) rememberedFolder.delete()
  } catch {
    // Forgetting costs a prompt next time, nothing more.
  }
}

async function pickFolder(): Promise<Directory | null> {
  const recalled = recalledFolder()
  if (recalled !== null) return recalled
  try {
    const picked = await Directory.pickDirectoryAsync(
      Platform.OS === 'android' ? FIRST_PICK_TREE : undefined,
    )
    remember(picked)
    return picked
  } catch {
    // The picker rejects on cancel, which is the one answer this port has for "nothing chosen".
    return null
  }
}

async function chooseDelivery(contentType: string | undefined): Promise<Delivery | null> {
  if (photoLibraryExtension(contentType) !== null) {
    // Add-only: saving asks for nothing that reads the library, and on Android 13 and up for
    // nothing at all.
    const permission = await requestPermissionsAsync(true, ['photo', 'video'])
    return permission.granted ? { to: 'photos' } : null
  }
  const folder = await pickFolder()
  return folder === null ? null : { to: 'folder', folder }
}

/**
 * Opens where an export went, as desktop opens its file manager on the file: the photo in the
 * gallery, or the folder in the file manager.
 *
 * Best effort. The file has landed by now, so a device with nothing to open it in has lost
 * nothing, and the export is not reported as failed for it.
 */
async function revealDelivered(target: string | null): Promise<void> {
  if (target === null) return
  try {
    await Linking.openURL(target)
  } catch {
    // Nothing on the device opens it; the file is where it was put either way.
  }
}

/**
 * What to open once a delivery has landed, or null where there is nothing to open.
 *
 * iOS has no view of one photo or one folder another app can be pointed at from here, so it opens
 * the app that holds it: Photos, or Files.
 */
function revealTarget(delivery: Delivery, asset: Asset | null): string | null {
  if (Platform.OS === 'ios')
    return delivery.to === 'photos' ? 'photos-redirect://' : 'shareddocuments://'
  if (delivery.to === 'photos') return asset?.id ?? null
  return folderDocumentUri(delivery.folder.uri)
}

/**
 * expo-file-system's code for a copy refused because the name is in use. Android's: iOS passes
 * the file manager's error through with no code of its own.
 */
const NAME_TAKEN = 'ERR_DESTINATION_ALREADY_EXISTS'

function isNameTaken(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === NAME_TAKEN
}

/**
 * Copies into a document tree, where expo-file-system renames nothing: `File.rename` opens a
 * local path, and a move within the tree changes the parent and keeps the name. So the staged
 * file takes each candidate name in turn and the copy itself is the probe.
 */
async function copyIntoTree(staged: File, folder: Directory): Promise<void> {
  await placeUnderFreeName(
    staged.name,
    async (candidate) => {
      if (candidate !== staged.name) staged.rename(candidate)
      await staged.copy(folder)
    },
    isNameTaken,
  )
}

/**
 * Copies into a local folder under a `.part` name and renames into place, so a copy that dies
 * leaves a file that looks unfinished rather than one that looks whole. The rename is the probe:
 * the file manager refuses one onto a name in use with no code to tell it from anything else, so
 * a failed one is read back by whether the name is there.
 */
async function copyThenRename(staged: File, folder: Directory): Promise<void> {
  const name = staged.name
  staged.rename(`${name}.part`)
  const part = new File(folder, staged.name)
  try {
    // A `.part` left by an export that died is nothing anybody wants kept.
    await staged.copy(folder, { overwrite: true })
    await placeUnderFreeName(
      name,
      (candidate) => {
        part.rename(candidate)
      },
      (_error, candidate) => new File(folder, candidate).exists,
    )
  } catch (error) {
    try {
      part.delete()
    } catch {
      // Never made, or gone; the failure being reported is the copy's.
    }
    throw error
  }
}

/** Puts a staged file in a picked folder under a name nothing there has. */
async function deliverToFolder(staged: File, folder: Directory): Promise<void> {
  try {
    // A picked folder is a document tree on Android and a plain path on iOS.
    if (folder.uri.startsWith('file://')) await copyThenRename(staged, folder)
    else await copyIntoTree(staged, folder)
  } catch (error) {
    // A grant revoked in the system settings fails the copy like anything else would, and only
    // the picker can tell them apart; forgetting costs one prompt.
    if (!isNameTaken(error)) remember(null)
    throw error
  }
}

/**
 * Exporting, on mobile: a picture or a video goes to the photo library and anything else to a
 * folder somebody picks, which is what both legacy clients do. Android remembers the folder.
 * Once it has landed, where it went is opened, as desktop opens its file manager.
 */
export const exportFiles: Pick<FilesPort, 'chooseExportLocation' | 'revealInFolder'> = {
  async chooseExportLocation(suggestedName, contentType) {
    const delivery = await chooseDelivery(contentType)
    if (delivery === null) return null
    const token = Crypto.randomUUID()
    new Directory(fileUrl(`${EXPORT_ROOT}/${token}`)).create({ intermediates: true })
    staged.stage(token, delivery)
    return stagedPath(EXPORT_ROOT, token, exportFileName(suggestedName, contentType))
  },

  async revealInFolder(path) {
    const written = staged.deliver(path)
    if (written === null) throw new Error('not a staged export')
    const { token, delivery } = written
    let asset: Asset | null = null
    try {
      const file = new File(fileUrl(path))
      if (delivery.to === 'photos') asset = await Asset.create(file.uri)
      else await deliverToFolder(file, delivery.folder)
    } finally {
      removeStaging(token)
    }
    await revealDelivered(revealTarget(delivery, asset))
  },
}
