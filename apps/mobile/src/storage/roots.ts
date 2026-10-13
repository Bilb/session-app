/**
 * **The only file in the mobile app that reaches the file system.** Every directory the app
 * writes into is one of the roots handed out here, which the native `storage-roots` module creates
 * under data protection class C and excludes from backup. A file written anywhere else --
 * Documents, which iCloud backs up -- would escape both, so dependency-cruiser and ESLint refuse
 * `expo-file-system` outside `src/storage/`. See docs/STORAGE.md.
 */
import type { NetworkName } from '@session/basic-types'
import { requireOptionalNativeModule } from 'expo'
import { Directory, Paths } from 'expo-file-system'

import {
  databaseFiles,
  fileUri,
  libsessionPaths,
  ROOT_NAMES,
  rootIsProtected,
  storageRow,
  unprotectedRoots,
  type RootReport,
  type RootState,
  type StorageRootPaths,
} from './layout'

export { Directory, File, FileMode } from 'expo-file-system'

interface StorageRootsModule {
  readonly roots: StorageRootPaths
  /** Where the roots are, as the startup block says it. */
  readonly location: string
  /** Creates and protects every root; returns what failed. */
  ensure(): string[]
  /** Protects one file; false when there is nothing there. */
  protect(path: string): boolean
  /** Throws when there is nothing there. */
  inspect(path: string): RootState
}

/** Null in a dev client built before the module existed. */
const native = requireOptionalNativeModule<StorageRootsModule>('StorageRoots')

/** Why the roots are not the protected ones, or null. Said in the log once it is open. */
export const rootsProblem: string | null =
  native === null
    ? 'the storage-roots module is not in this build, so data is in Documents, unprotected and ' +
      'backed up; rebuild the dev client'
    : null

if (rootsProblem !== null) console.error(`[storage] ${rootsProblem}`)

const roots: StorageRootPaths =
  native?.roots ?? unprotectedRoots(Paths.document.uri, Paths.cache.uri)

/** One root, or a directory inside one, created if it is not there. */
function directory(path: string): Directory {
  const dir = new Directory(fileUri(path))
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

/**
 * The log directory, not created here: the logs create it when they open, inside the handling that
 * sends their lines to the console when it cannot be.
 */
export const logsRoot: Directory = new Directory(fileUri(roots.logs))

/** Where exports are staged for the share sheet, created if missing. */
export function exportsDirectory(): Directory {
  return directory(roots.exports)
}

/**
 * One network's database files (the database, -wal, -shm) and attachment cache, as handles to read
 * sizes from. Nothing is created: a directory that is not there yet has no size to report.
 */
export function sessionFiles(network: NetworkName): {
  database: [File, File, File]
  attachments: Directory
} {
  const paths = libsessionPaths(roots.data, network)
  const [database, wal, shm] = databaseFiles(paths.dbPath).map((path) => new File(fileUri(path)))
  if (database === undefined || wal === undefined || shm === undefined) {
    throw new Error('databaseFiles names three files')
  }
  return { database: [database, wal, shm], attachments: new Directory(fileUri(paths.cacheDir)) }
}

/** Where libsession keeps one network's database and attachments, both created if missing. */
export function sessionPaths(network: NetworkName): { dbPath: string; cacheDir: string } {
  const paths = libsessionPaths(roots.data, network)
  directory(paths.cacheDir)
  return paths
}

/**
 * Protects the database and its -wal and -shm, once libsession has opened them; returns what
 * failed. SQLite creates them in place, so they would inherit the root's class -- but since iOS 26
 * a file can keep the class of wherever it was first written, and legacy re-applies both
 * attributes after every open for the same reason.
 */
export function protectDatabase(dbPath: string): string[] {
  if (native === null) return []
  const failures: string[] = []
  for (const path of databaseFiles(dbPath)) {
    try {
      native.protect(path)
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return failures
}

/**
 * Each root as the file system reports it, for the startup block, and what needed doing about any
 * that were not protected. A root missing either attribute is re-protected at once rather than
 * left until the next launch.
 */
export function checkRoots(): { row: readonly [string, string]; warnings: string[] } {
  if (native === null)
    return { row: ['Storage', 'Documents, unprotected and backed up'], warnings: [] }
  const reports = ROOT_NAMES.map((name): RootReport => {
    try {
      return [name, native.inspect(roots[name])]
    } catch (error) {
      return [name, error instanceof Error ? error.message : String(error)]
    }
  })
  const unprotected = reports.filter(
    ([, state]) => typeof state === 'string' || !rootIsProtected(state),
  )
  const warnings: string[] = []
  if (unprotected.length > 0) {
    warnings.push(
      `not protected, so protecting again: ${unprotected.map(([name]) => name).join(', ')}`,
    )
    warnings.push(...native.ensure().map((failure) => `could not protect ${failure}`))
  }
  return { row: ['Storage', storageRow(native.location, reports)], warnings }
}
