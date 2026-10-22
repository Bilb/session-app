import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveDatabaseKey, type KeySealer } from '#src/main/databaseKey'

/** A keyring that can be taken away or broken, sealing as safeStorage does: longer than a key. */
function sealer(): KeySealer & { available: boolean; broken: boolean } {
  return {
    available: true,
    broken: false,
    isEncryptionAvailable() {
      return this.available
    },
    encryptString(plain) {
      return Buffer.concat([Buffer.from('v11'), Buffer.from(plain)])
    },
    decryptString(sealed) {
      if (this.broken) throw new Error('Error while decrypting the ciphertext provided')
      return sealed.subarray(3).toString()
    },
  }
}

function place(): { dir: string; dbPath: string; keyFile: string } {
  const dir = mkdtempSync(join(tmpdir(), 'session-db-key-'))
  return { dir, dbPath: join(dir, 'session.db'), keyFile: join(dir, 'db-key.bin') }
}

describe('resolveDatabaseKey', () => {
  it('makes a key at first boot, sealed, and gives the same one back after', () => {
    const { dir, dbPath, keyFile } = place()
    const keyring = sealer()
    const key = resolveDatabaseKey(dir, dbPath, keyring)
    expect(key).toHaveLength(32)
    expect(readFileSync(keyFile).length).toBeGreaterThan(32)
    writeFileSync(dbPath, 'a database')
    expect(resolveDatabaseKey(dir, dbPath, keyring)).toEqual(key)
    expect(readdirSync(dir).sort()).toEqual(['db-key.bin', 'session.db'])
  })

  it('reads a key written with no keyring once a keyring is there, and the reverse refuses', () => {
    const { dir, dbPath, keyFile } = place()
    const keyring = sealer()
    keyring.available = false
    const plain = resolveDatabaseKey(dir, dbPath, keyring)
    expect(readFileSync(keyFile)).toEqual(Buffer.from(plain))
    keyring.available = true
    expect(resolveDatabaseKey(dir, dbPath, keyring)).toEqual(plain)

    const sealed = place()
    resolveDatabaseKey(sealed.dir, sealed.dbPath, keyring)
    writeFileSync(sealed.dbPath, 'a database')
    const before = readFileSync(sealed.keyFile)
    keyring.available = false
    expect(() => resolveDatabaseKey(sealed.dir, sealed.dbPath, keyring)).toThrow(
      /sealed, and this session has no keyring/,
    )
    expect(readFileSync(sealed.keyFile)).toEqual(before)
  })

  it('never replaces a key it cannot unseal', () => {
    const { dir, dbPath, keyFile } = place()
    const keyring = sealer()
    resolveDatabaseKey(dir, dbPath, keyring)
    writeFileSync(dbPath, 'a database')
    const before = readFileSync(keyFile)
    keyring.broken = true
    expect(() => resolveDatabaseKey(dir, dbPath, keyring)).toThrow(
      /could not be unsealed \(Error while decrypting/,
    )
    expect(readFileSync(keyFile)).toEqual(before)
  })

  it('refuses a key that unseals to the wrong length', () => {
    const { dir, dbPath, keyFile } = place()
    writeFileSync(keyFile, Buffer.concat([Buffer.from('v11'), Buffer.from('c2hvcnQ=')]))
    expect(() => resolveDatabaseKey(dir, dbPath, sealer())).toThrow(/unsealed to 5 bytes/)
  })

  it('makes no key for a database whose key has gone, and names no path', () => {
    const { dir, dbPath, keyFile } = place()
    writeFileSync(dbPath, 'a database')
    expect(() => resolveDatabaseKey(dir, dbPath, sealer())).toThrow(
      /^The database key is missing beside an existing database/,
    )
    expect(existsSync(keyFile)).toBe(false)
  })
})
