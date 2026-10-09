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

/** A file's size, or null where it is not there. */
function sizeOf(file: File): number | null {
  return file.exists ? file.size : null
}

/** The database and its journals, `session.db`, `-wal`, `-shm`; null when there is no database. */
export function databaseSizes(): DatabaseSizes | null {
  const root = sessionRoot()
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
  const attachments = new Directory(sessionRoot(), 'attachments')
  return attachments.exists ? attachments.size : null
}
