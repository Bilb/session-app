import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { KEY_INVALID, KEY_MISSING, KEY_UNAVAILABLE } from '@session/client'
import { describe, expect, it } from 'vitest'

import { replaceDatabase, resolveDatabaseKey, type KeySealer } from '#src/main/databaseKey'

/**
 * A keyring that seals by prefixing, so a sealed key is told from a plain one by its bytes, as
 * safeStorage's are. `locked` makes it refuse to unseal, as a locked keychain does.
 */
function keyring({ available = true, locked = false } = {}): KeySealer {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (text) => Buffer.from(`sealed:${text}`),
    decryptString: (sealed) => {
      if (locked) throw new Error('Error while decrypting the ciphertext provided')
      const text = sealed.toString()
      if (!text.startsWith('sealed:')) throw new Error('not sealed')
      return text.slice('sealed:'.length)
    },
  }
}

function dataDir(): string {
  return mkdtempSync(join(tmpdir(), 'db-key-'))
}

/** What `run` threw, which every case here expects it to. */
function thrown(run: () => unknown): { code?: unknown; message: string } {
  try {
    run()
  } catch (error) {
    if (error instanceof Error) return error
  }
  throw new Error('nothing was thrown')
}

const keyFile = (dir: string) => join(dir, 'db-key.bin')
const database = (dir: string) => join(dir, 'session.db')

describe('the desktop database key', () => {
  it('is made and sealed on a first boot, and read back after', () => {
    const dir = dataDir()
    const key = resolveDatabaseKey(dir, keyring())
    expect(key).toHaveLength(32)
    expect(readFileSync(keyFile(dir)).toString()).toBe(`sealed:${Buffer.from(key).toString('hex')}`)
    expect(resolveDatabaseKey(dir, keyring())).toEqual(key)
  })

  it('is still read when an earlier build sealed it as base64', () => {
    const dir = dataDir()
    const key = Buffer.alloc(32, 0xab)
    writeFileSync(keyFile(dir), `sealed:${key.toString('base64')}`)
    writeFileSync(database(dir), 'pages')
    expect(resolveDatabaseKey(dir, keyring())).toEqual(new Uint8Array(key))
    expect(readFileSync(keyFile(dir)).toString()).toBe(`sealed:${key.toString('base64')}`)
  })

  it('is kept in plaintext where there is no keyring, and read back after', () => {
    const dir = dataDir()
    const key = resolveDatabaseKey(dir, keyring({ available: false }))
    expect(readFileSync(keyFile(dir))).toHaveLength(32)
    expect(resolveDatabaseKey(dir, keyring({ available: false }))).toEqual(key)
  })

  it('is never made while a database exists without one', () => {
    const dir = dataDir()
    writeFileSync(database(dir), 'pages')
    expect(() => resolveDatabaseKey(dir, keyring())).toThrow(
      expect.objectContaining({ code: KEY_MISSING }),
    )
    expect(existsSync(keyFile(dir))).toBe(false)
  })

  it('is never written over when the keychain will not unseal it', () => {
    const dir = dataDir()
    resolveDatabaseKey(dir, keyring())
    const sealed = readFileSync(keyFile(dir))
    expect(() => resolveDatabaseKey(dir, keyring({ locked: true }))).toThrow(
      expect.objectContaining({ code: KEY_UNAVAILABLE }),
    )
    expect(readFileSync(keyFile(dir))).toEqual(sealed)
  })

  it('is never written over when the keyring that sealed it is not running', () => {
    const dir = dataDir()
    resolveDatabaseKey(dir, keyring())
    const sealed = readFileSync(keyFile(dir))
    expect(() => resolveDatabaseKey(dir, keyring({ available: false }))).toThrow(
      expect.objectContaining({ code: KEY_UNAVAILABLE }),
    )
    expect(readFileSync(keyFile(dir))).toEqual(sealed)
  })

  it('is never written over when the file cannot be read, database or not', () => {
    const dir = dataDir()
    mkdirSync(keyFile(dir))
    const failure = thrown(() => resolveDatabaseKey(dir, keyring()))
    expect(failure.code).toBe(KEY_UNAVAILABLE)
    expect(failure.message).toMatch(/EISDIR/)
  })

  it('is refused, not replaced, when what unseals is not 32 bytes', () => {
    const dir = dataDir()
    writeFileSync(keyFile(dir), `sealed:${Buffer.alloc(16).toString('base64')}`)
    const failure = thrown(() => resolveDatabaseKey(dir, keyring()))
    expect(failure.code).toBe(KEY_INVALID)
    expect(failure.message).toMatch(/16 bytes/)
  })

  it('never carries the key in a failure', () => {
    const dir = dataDir()
    const secret = Buffer.alloc(16, 7).toString('base64')
    writeFileSync(keyFile(dir), `sealed:${secret}`)
    expect(thrown(() => resolveDatabaseKey(dir, keyring())).message).not.toContain(secret)
  })
})

describe('the clear past a key failure', () => {
  it('deletes what the bridge discards, keeps the node cache, and makes a key that opens', () => {
    const dir = dataDir()
    for (const name of ['session.db', 'session.db-wal', 'session.db-shm']) {
      writeFileSync(join(dir, name), 'pages')
    }
    mkdirSync(join(dir, 'attachments'))
    writeFileSync(join(dir, 'attachments', 'a'), 'picture')
    writeFileSync(join(dir, 'netcache'), 'nodes')
    writeFileSync(keyFile(dir), 'sealed:not-the-key')

    replaceDatabase(dir, keyring())

    for (const name of ['session.db', 'session.db-wal', 'session.db-shm', 'attachments']) {
      expect(existsSync(join(dir, name))).toBe(false)
    }
    expect(existsSync(join(dir, 'netcache'))).toBe(true)
    expect(resolveDatabaseKey(dir, keyring())).toHaveLength(32)
  })

  it('can be pressed again after one that stopped part way', () => {
    const dir = dataDir()
    replaceDatabase(dir, keyring())
    const first = resolveDatabaseKey(dir, keyring())
    replaceDatabase(dir, keyring())
    expect(resolveDatabaseKey(dir, keyring())).not.toEqual(first)
  })
})
