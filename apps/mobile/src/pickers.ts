import type { FilesPort, PickedFile } from '@session/app'
import { stagedThumbnailUrl } from '@session/app/mediaUrl'
import { isDisplayableImage } from '@session/basic-types'
import { getDocumentAsync } from 'expo-document-picker'
import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from 'expo-image-picker'

import { lastSegment } from './pickedPaths'
import { discardStaged, keepPicked } from './storage/staging'

async function picked(
  copy: string,
  name: string,
  contentType?: string,
  size?: number,
): Promise<PickedFile> {
  const path = await keepPicked(copy, lastSegment(copy))
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
  | 'pickFiles'
  | 'pickImages'
  | 'droppedFiles'
  | 'picksAreCopies'
  | 'discardPicked'
  | 'releasePreview'
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
  // A tile draws the copy by its path, which grants nothing.
  releasePreview: () => undefined,
  discardPicked: (file) => {
    discardStaged(file.path)
  },
}
