import { requireNativeModule } from 'expo'
import { Platform } from 'react-native'

interface SafDocumentModule {
  deliver(treeUri: string, sourcePath: string, name: string): Promise<string>
}

/** The code `deliver` fails with when the picked folder's grant is gone. */
export const FOLDER_ACCESS_LOST = 'ERR_FOLDER_ACCESS_LOST'

/**
 * Lands a file in a picked Android document tree under a free name, written under a temporary
 * name and renamed once whole where the provider can rename. See `modules/saf-document`.
 *
 * Null on iOS, where a picked folder is a plain path.
 */
export const deliverIntoTree:
  ((treeUri: string, sourcePath: string, name: string) => Promise<string>) | null =
  Platform.OS === 'android'
    ? (treeUri, sourcePath, name) =>
        requireNativeModule<SafDocumentModule>('SafDocument').deliver(treeUri, sourcePath, name)
    : null
