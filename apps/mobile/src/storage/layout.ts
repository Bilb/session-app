import type { NetworkName } from '@session/basic-types'

/**
 * The directories everything the app keeps lives under, as plain paths.
 *
 * The native `storage-roots` module creates them, gives each data protection class C and excludes
 * it from backup -- see `modules/storage-roots`. Everything here is pure, so the layout can be
 * tested without either.
 */
export interface StorageRootPaths {
  /** libsession's root: a directory per network inside it. */
  data: string
  logs: string
  /** Decrypted copies on their way out of the app, to the share sheet. */
  exports: string
  /** Copies of what was picked, until a send takes them. */
  staged: string
}

export type RootName = keyof StorageRootPaths

export const ROOT_NAMES: readonly RootName[] = ['data', 'logs', 'exports', 'staged']

/** What the file system reports for one root: see the native module's `inspect`. */
export interface RootState {
  /**
   * iOS's class by name (`completeUntilFirstUserAuthentication`), `unreported` where the OS gives
   * none -- the simulator -- and `credentialEncrypted` for Android's app-private storage.
   */
  protection: string
  excludedFromBackup: boolean
}

/**
 * The `file://` form expo-file-system takes, each path segment percent-encoded whole so that a `?`
 * or `#` in a name stays part of the path. `plainPath` is its exact inverse.
 */
export function fileUri(path: string): string {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`
}

/** The plain path libsession and the native modules take, from a `file://` URI of either origin. */
export function plainPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

/**
 * The database and the attachment cache for one network.
 *
 * Split by network, so a devnet identity and a mainnet one can both exist and switching back
 * loses neither. libsession derives its own snode cache from the database's directory, which puts
 * that on the right side of the split too - a cache of nodes that do not exist on the other
 * network is worse than none.
 */
export function libsessionPaths(
  dataRoot: string,
  network: NetworkName,
): { dbPath: string; cacheDir: string } {
  const root = `${dataRoot}/${network}`
  return { dbPath: `${root}/session.db`, cacheDir: `${root}/attachments` }
}

/** The database and the two files SQLite keeps beside it in WAL mode. */
export function databaseFiles(dbPath: string): string[] {
  return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]
}

/**
 * Whether a root is as it should be: excluded from backup, and readable once the device has been
 * unlocked since boot but not before.
 *
 * A stronger class is wrong too, not merely stricter: under class A nothing could be written while
 * the phone is locked, which is when messages arrive. A class the OS does not report passes,
 * because nothing can be done about it.
 */
export function rootIsProtected(state: RootState): boolean {
  return (
    state.excludedFromBackup &&
    ['completeUntilFirstUserAuthentication', 'credentialEncrypted', 'unreported'].includes(
      state.protection,
    )
  )
}

const PROTECTION_NAMES: Readonly<Record<string, string>> = {
  completeUntilFirstUserAuthentication: 'class C',
  complete: 'class A',
  completeWhenUserInactive: 'class A (inactive)',
  completeUnlessOpen: 'class B',
  none: 'class D',
  credentialEncrypted: 'credential-encrypted',
  unreported: 'class unreported',
}

/** One root, or why it could not be read. */
export type RootReport = readonly [RootName, RootState | string]

/**
 * The startup block's `Storage` row: where the roots are, then each root's class and backup state.
 * `app group · data class C, not backed up · logs class C, not backed up · ...`
 */
export function storageRow(location: string, roots: readonly RootReport[]): string {
  const each = roots.map(([name, state]) => {
    if (typeof state === 'string') return `${name} unreadable (${state})`
    const protection = PROTECTION_NAMES[state.protection] ?? state.protection
    return `${name} ${protection}, ${state.excludedFromBackup ? 'not backed up' : 'BACKED UP'}`
  })
  return [location, ...each].join(' · ')
}
