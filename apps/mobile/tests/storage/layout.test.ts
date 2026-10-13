import { describe, expect, it } from 'vitest'

import {
  databaseFiles,
  fileUri,
  libsessionPaths,
  plainPath,
  rootIsProtected,
  storageRow,
  unprotectedRoots,
} from '#src/storage/layout'

const GROUP = '/private/var/mobile/Containers/Shared/AppGroup/0B1C/session'

describe('the storage layout', () => {
  it('gives each network its own database and attachments under the data root', () => {
    expect(libsessionPaths(GROUP, 'mainnet')).toEqual({
      dbPath: `${GROUP}/mainnet/session.db`,
      cacheDir: `${GROUP}/mainnet/attachments`,
    })
    expect(libsessionPaths(GROUP, 'devnet').dbPath).toBe(`${GROUP}/devnet/session.db`)
  })

  it('names the files SQLite keeps beside the database', () => {
    expect(databaseFiles('/d/session.db')).toEqual([
      '/d/session.db',
      '/d/session.db-wal',
      '/d/session.db-shm',
    ])
  })

  it('turns a path into the URI expo-file-system takes, and back', () => {
    const path = '/data/user/0/org.getsession.session2/files/My Logs'
    expect(fileUri(path)).toBe('file:///data/user/0/org.getsession.session2/files/My%20Logs')
    expect(plainPath(fileUri(path))).toBe(path)
  })

  it('falls back to the unprotected layout without the native module', () => {
    expect(unprotectedRoots('file:///app/Documents/', 'file:///app/Library/Caches/')).toEqual({
      data: '/app/Documents/session',
      logs: '/app/Documents/logs',
      exports: '/app/Library/Caches/exports',
    })
  })
})

describe('a root', () => {
  it('is protected under class C, or credential-encrypted, and excluded from backup', () => {
    const classC = 'completeUntilFirstUserAuthentication'
    expect(rootIsProtected({ protection: classC, excludedFromBackup: true })).toBe(true)
    expect(rootIsProtected({ protection: 'credentialEncrypted', excludedFromBackup: true })).toBe(
      true,
    )
    expect(rootIsProtected({ protection: classC, excludedFromBackup: false })).toBe(false)
  })

  it('is wrong under a stronger class, which would refuse writes on a locked phone', () => {
    expect(rootIsProtected({ protection: 'complete', excludedFromBackup: true })).toBe(false)
    expect(rootIsProtected({ protection: 'none', excludedFromBackup: true })).toBe(false)
  })

  it('passes with a class the simulator does not report', () => {
    expect(rootIsProtected({ protection: 'unreported', excludedFromBackup: true })).toBe(true)
  })
})

describe('the startup row', () => {
  it('says where the roots are and how each is kept', () => {
    expect(
      storageRow('app group', [
        ['data', { protection: 'completeUntilFirstUserAuthentication', excludedFromBackup: true }],
        ['logs', { protection: 'complete', excludedFromBackup: false }],
        ['exports', 'no such file'],
      ]),
    ).toBe(
      'app group · data class C, not backed up · logs class A, BACKED UP · ' +
        'exports unreadable (no such file)',
    )
  })
})
