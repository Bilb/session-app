import { parseNetworkName } from '@session/basic-types'
import type { DatabaseSizes } from '@session/logging'
import { Directory, File, Paths } from 'expo-file-system'

/** Where this build's database lives: per network, as `storage.ts` puts it. */
function sessionRoot(): Directory {
  return new Directory(
    Paths.document,
    'session',
    parseNetworkName(process.env['EXPO_PUBLIC_SESSION_NETID']),
  )
}

/**
 * A figure read off disk, or null where reading it threw: these feed the export's header and the
 * database lines, and a figure that could not be read must not cost either of them.
 */
function probe<T>(read: () => T): T | null {
  try {
    return read()
  } catch {
    return null
  }
}

/** A file's size, or null where it is not there or cannot be read. */
function sizeOf(file: File): number | null {
  return probe(() => (file.exists ? file.size : null))
}

/** The database and its journals, `session.db`, `-wal`, `-shm`; null when there is no database. */
export function databaseSizes(): DatabaseSizes | null {
  const root = probe(sessionRoot)
  if (root === null) return null
  const databaseBytes = sizeOf(new File(root, 'session.db'))
  if (databaseBytes === null) return null
  return {
    databaseBytes,
    walBytes: sizeOf(new File(root, 'session.db-wal')),
    shmBytes: sizeOf(new File(root, 'session.db-shm')),
  }
}

/** The attachment cache's size on disk, or null where there is none yet. */
export function attachmentsBytes(): number | null {
  return probe(() => {
    const attachments = new Directory(sessionRoot(), 'attachments')
    return attachments.exists ? attachments.size : null
  })
}
