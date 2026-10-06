/** The access an export destination can need: storage on Android 8 to 10, photos on iOS. */
export type ExportAccess = 'storage' | 'photoLibrary'

/**
 * Rejected by `chooseExportLocation` when the destination needs access the OS will not ask for
 * again, so only the app's page in the system settings can grant it.
 */
export class ExportAccessRefused extends Error {
  override readonly name = 'ExportAccessRefused'
  readonly access: ExportAccess

  constructor(access: ExportAccess) {
    super(`${access} access is refused, and the system will not ask for it again`)
    this.access = access
  }
}
