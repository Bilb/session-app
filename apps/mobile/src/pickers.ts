import type { FilesPort, PickedFile } from '@session/app'
import { stagedThumbnailUrl } from '@session/app/mediaUrl'
import { isDisplayableImage } from '@session/basic-types'
import { getDocumentAsync } from 'expo-document-picker'
import { randomUUID } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'

import { fileUrl, lastSegment, pathOf } from './pickedPaths'
import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from 'expo-image-picker'

/**
 * Where staged copies live: under documents, not the cache the pickers write to, because the OS
 * may empty a cache and libsession reads a file only when its upload's turn comes.
 */
const STAGED = new Directory(Paths.document, 'staged-attachments')
const STAGED_ROOT = pathOf(STAGED.uri).replace(/\/+$/, '') + '/'

/** Moves a picker's copy into the staged folder, under a name of its own. */
async function keep(uri: string): Promise<string> {
  if (!STAGED.exists) STAGED.create({ intermediates: true, idempotent: true })
  const target = new File(STAGED, `${randomUUID()}-${lastSegment(uri)}`)
  await new File(uri).move(target)
  return target.uri
}

async function picked(
  copy: string,
  name: string,
  contentType?: string,
  size?: number,
): Promise<PickedFile> {
  const path = pathOf(await keep(copy))
  return {
    path,
    name,
    contentType,
    size,
    // libsession's thumbnail rather than the copy: a tile decoding 32 full photographs is the
    // memory a phone runs out of. A video has no still here.
    previewUrl: isDisplayableImage(contentType)
      ? (stagedThumbnailUrl(path) ?? undefined)
      : undefined,
  }
}

/**
 * The two system pickers + offers on a phone or a tablet.
 *
 * Both copy what was chosen into the app's cache, which is what makes it a path libsession can
 * read: a photo library or a document provider is not one. The copy is then moved out of the cache.
 */
export const pickers: Pick<
  FilesPort,
  'pickFiles' | 'pickImages' | 'droppedFiles' | 'picksAreCopies' | 'discardPicked'
> = {
  picksAreCopies: true,
  pickFiles: async () => {
    const result = await getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return []
    return Promise.all(
      result.assets.map((asset) => picked(asset.uri, asset.name, asset.mimeType, asset.size)),
    )
  },
  pickImages: async (options) => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      // Every one picked is copied and, on iOS, transcoded before any comes back, so the picker
      // stops at what the message can take rather than copying the ones that would be refused.
      ...(options?.limit === undefined ? {} : { selectionLimit: Math.max(1, options.limit) }),
      // No recompression on top of the conversion below: a JPEG is passed through as it is.
      quality: 1,
      // A HEIC photo arrives as JPEG, which every client can draw.
      preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })
    if (result.canceled) return []
    return Promise.all(
      result.assets.map((asset) =>
        picked(asset.uri, asset.fileName ?? lastSegment(asset.uri), asset.mimeType, asset.fileSize),
      ),
    )
  },
  // Nothing is dropped on a phone or a tablet: `DropZone` there takes no drop.
  droppedFiles: () => Promise.resolve([]),
  discardPicked: (file) => {
    // Only our own copies: a path anywhere else is not one this app made.
    if (!file.path.startsWith(STAGED_ROOT)) return
    try {
      new File(fileUrl(file.path)).delete()
    } catch {
      // Already gone; the OS purges the cache on its own as well.
    }
  },
}
