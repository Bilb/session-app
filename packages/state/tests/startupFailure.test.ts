import { BRIDGE_UNAVAILABLE, KEY_INVALID, KEY_MISSING, KEY_UNAVAILABLE } from '@session/client'
import { describe, expect, it } from 'vitest'

import { classifyStartupFailure, isClearable, type StartupFailureKind } from '#src/startupFailure'

/** What the store is handed, as the bridge or a key resolver words it, and what it is. */
const CASES: [message: string, code: string | undefined, kind: StartupFailureKind][] = [
  // Unreadable: no restart gets past these.
  [
    'setAttachmentCacheLimit: the bridge has no database open: file is not a database',
    undefined,
    'unreadable',
  ],
  [
    'setAttachmentCacheLimit: the bridge has no database open: database disk image is malformed',
    undefined,
    'unreadable',
  ],
  ['getConversations: File Is Not A Database', undefined, 'unreadable'],
  ['DATABASE DISK IMAGE IS MALFORMED', undefined, 'unreadable'],
  ['the database key is missing, but a database exists', KEY_MISSING, 'unreadable'],
  ['the database key is not a key: 44 bytes, not 32', KEY_INVALID, 'unreadable'],
  // Transient: a restart may clear these.
  ['the database key could not be read: the keychain is locked', KEY_UNAVAILABLE, 'transient'],
  [
    'setAttachmentCacheLimit: the bridge has no database open: database is locked',
    undefined,
    'transient',
  ],
  [
    'setAttachmentCacheLimit: the bridge has no database open: database table is locked',
    undefined,
    'transient',
  ],
  [
    'setAttachmentCacheLimit: the bridge has no database open: unable to open database file',
    undefined,
    'transient',
  ],
  [
    'setAttachmentCacheLimit: the bridge has no database open: database or disk is full',
    undefined,
    'transient',
  ],
  [
    'setAttachmentCacheLimit: the bridge has no database open: disk I/O error',
    undefined,
    'transient',
  ],
  ['getAccountInfo: something libsession said', undefined, 'transient'],
  ['getAccountInfo: something libsession said', 'contact.not_found', 'transient'],
  ['discardAccount: EACCES: permission denied', undefined, 'transient'],
  // A phrase only as a whole phrase: not inside a longer word.
  ['profile is not a databases', undefined, 'transient'],
  ['xfile is not a database', undefined, 'transient'],
  // No bridge, for a reason that is not the key, whatever its text says.
  ['the bridge could not start: no native module', BRIDGE_UNAVAILABLE, 'noBridge'],
  ['the bridge could not start: file is not a database', BRIDGE_UNAVAILABLE, 'noBridge'],
]

describe('a failed start', () => {
  it.each(CASES)('"%s" (%s) is %s', (message, code, kind) => {
    expect(classifyStartupFailure(message, code)).toBe(kind)
  })
})

describe('clearing a failed start', () => {
  it('is offered wherever a bridge was made, and nowhere else', () => {
    expect(isClearable('unreadable')).toBe(true)
    expect(isClearable('transient')).toBe(true)
    expect(isClearable('noBridge')).toBe(false)
  })
})
