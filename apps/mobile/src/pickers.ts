import type { FilesPort, PickedFile } from '@session/app'
import { isDisplayableImage } from '@session/basic-types'
import { getDocumentAsync } from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'

import { fileUrl, lastSegment, pathOf } from './pickedPaths'
import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from 'expo-image-picker'

// Where expo-document-picker and expo-image-picker put their copies.
const cacheRoot = decodeURIComponent(Paths.cache.uri.replace(/^file:\/\//, '')).replace(/\/+$/, '')
const PICKER_COPIES = [`${cacheRoot}/DocumentPicker/`, `${cacheRoot}/ImagePicker/`]

function picked(uri: string, name: string, contentType?: string, size?: number): PickedFile {
  return {
    path: pathOf(uri),
    name,
    contentType,
    size,
    // The copy itself, which both platforms' image loaders read. A video has no still here.
    previewUrl: isDisplayableImage(contentType) ? uri : undefined,
  }
}

/**
 * The two system pickers + offers on a phone or a tablet.
 *
 * Both copy what was chosen into the app's cache, which is what makes it a path libsession can
 * read: a photo library or a document provider is not one.
 */
export const pickers: Pick<
  FilesPort,
  'pickFiles' | 'pickImages' | 'droppedFiles' | 'discardPicked'
> = {
  pickFiles: async () => {
    const result = await getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return []
    return result.assets.map((asset) => picked(asset.uri, asset.name, asset.mimeType, asset.size))
  },
  pickImages: async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      // No recompression on top of the conversion below: a JPEG is passed through as it is.
      quality: 1,
      // A HEIC photo arrives as JPEG, which every client can draw.
      preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })
    if (result.canceled) return []
    return result.assets.map((asset) =>
      picked(asset.uri, asset.fileName ?? lastSegment(asset.uri), asset.mimeType, asset.fileSize),
    )
  },
  // Nothing is dropped on a phone or a tablet: `DropZone` there takes no drop.
  droppedFiles: () => Promise.resolve([]),
  discardPicked: (file) => {
    // Only the pickers' own copies: a path anywhere else is not one this app made.
    if (!PICKER_COPIES.some((folder) => file.path.startsWith(folder))) return
    try {
      new File(fileUrl(file.path)).delete()
    } catch {
      // Already gone; the OS purges the cache on its own as well.
    }
  },
}
