import { parseNetworkName } from '@session/basic-types'
import type { DatabaseSizes } from '@session/logging'

import { sessionFiles, type File } from './storage/roots'

/** This build's database and attachment cache: per network, as the storage module puts them. */
function current(): ReturnType<typeof sessionFiles> {
  return sessionFiles(parseNetworkName(process.env['EXPO_PUBLIC_SESSION_NETID']))
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
  const files = probe(current)
  if (files === null) return null
  const [database, wal, shm] = files.database
  const databaseBytes = sizeOf(database)
  if (databaseBytes === null) return null
  return { databaseBytes, walBytes: sizeOf(wal), shmBytes: sizeOf(shm) }
}

/** The attachment cache's size on disk, or null where there is none yet. */
export function attachmentsBytes(): number | null {
  return probe(() => {
    const { attachments } = current()
    return attachments.exists ? attachments.size : null
  })
}
