import type { FilesPort, PickedFile } from '@session/app'
import { isDisplayableImage } from '@session/basic-types'
import { getDocumentAsync } from 'expo-document-picker'
import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from 'expo-image-picker'

/** libsession takes a filesystem path; both pickers hand back a `file://` URL of their copy. */
function pathOf(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

function lastSegment(uri: string): string {
  return decodeURIComponent(uri.split('/').pop() ?? '')
}

function picked(uri: string, name: string, contentType?: string, size?: number): PickedFile {
  return {
    path: pathOf(uri),
    name,
    ...(contentType === undefined ? {} : { contentType }),
    ...(size === undefined ? {} : { size }),
    // The copy itself, which both platforms' image loaders read. A video has no still here.
    ...(isDisplayableImage(contentType) ? { previewUrl: uri } : {}),
  }
}

/**
 * The two system pickers + offers on a phone or a tablet.
 *
 * Both copy what was chosen into the app's cache, which is what makes it a path libsession can
 * read: a photo library or a document provider is not one.
 */
export const pickers: Pick<FilesPort, 'pickFiles' | 'pickImages' | 'droppedFiles'> = {
  pickFiles: async () => {
    const result = await getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return []
    return result.assets.map((asset) => picked(asset.uri, asset.name, asset.mimeType, asset.size))
  },
  pickImages: async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      // The original bytes, not a recompressed copy: what is sent is what was taken.
      quality: 1,
      // HEIC arrives as JPEG, which every client can draw; the legacy iOS client converts too.
      preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })
    if (result.canceled) return []
    return result.assets.map((asset) =>
      picked(asset.uri, asset.fileName ?? lastSegment(asset.uri), asset.mimeType, asset.fileSize),
    )
  },
  // Nothing is dropped on a phone or a tablet: `DropZone` there takes no drop.
  droppedFiles: () => Promise.resolve([]),
}
