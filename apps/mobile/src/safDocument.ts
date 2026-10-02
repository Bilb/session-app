import { requireOptionalNativeModule } from 'expo'

interface SafDocumentModule {
  deliver(treeUri: string, sourcePath: string, name: string): Promise<string>
}

/**
 * Lands a file in a picked Android document tree under a free name, written as `.part` and
 * renamed once whole. See `modules/saf-document`.
 *
 * Null in a dev client built before the module existed, where the plain copy still works.
 */
const SafDocument = requireOptionalNativeModule<SafDocumentModule>('SafDocument')

export const deliverIntoTree:
  ((treeUri: string, sourcePath: string, name: string) => Promise<string>) | null =
  SafDocument === null
    ? null
    : (treeUri, sourcePath, name) => SafDocument.deliver(treeUri, sourcePath, name)
