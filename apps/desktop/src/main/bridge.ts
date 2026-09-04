import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

import electron from 'electron'

import type { BridgeTransport } from '@session/client'

const { app, safeStorage } = electron

/**
 * The database key.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is ours. A random
 * 32 bytes at first boot, sealed with safeStorage and kept beside the database. The renderer
 * never sees it: it lives in the main process, which is also the only process that can load
 * the addon.
 *
 * safeStorage degrades to plaintext where there is no keyring — a bare Linux session, most
 * often — and says so. Encrypting anyway would be a claim we cannot keep; the fallback that
 * belongs here is the argon2id password path the bridge already supports, which needs a
 * screen to ask on and so waits for onboarding.
 */
function resolveDatabaseKey(dir: string): Uint8Array {
  const keyFile = join(dir, 'db-key.bin')

  try {
    const stored = readFileSync(keyFile)
    return safeStorage.isEncryptionAvailable()
      ? new Uint8Array(Buffer.from(safeStorage.decryptString(stored), 'base64'))
      : new Uint8Array(stored)
  } catch {
    // No key yet: this is a first boot.
  }

  const key = randomBytes(32)
  writeFileSync(
    keyFile,
    safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key.toString('base64')) : key,
    { mode: 0o600 },
  )
  return new Uint8Array(key)
}

/**
 * Opens the bridge the renderer talks to.
 *
 * The fake is reached through a dynamic import from a dev-only module, so a production build
 * has no path to it at all. Everything above this file sees frames either way.
 */
export async function createBridge(): Promise<BridgeTransport> {
  if (process.env['SESSION_FAKE'] === '1') {
    const { createFakeBridge } = await import('./dev/fakeBridge')
    return createFakeBridge()
  }

  const { createNodeBridgeTransport } = await import('@session/bridge-node')

  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })

  return createNodeBridgeTransport({
    dbPath: join(dir, 'session.db'),
    cacheDir: join(dir, 'attachments'),
    rawKey: resolveDatabaseKey(dir),
    // Onboarding has to be asked. Without this libsession creates an account as the database
    // opens, and the first screen the user sees is a conversation list for an identity nobody
    // chose.
    deferAccount: true,
    // The bridge attaches this once an account exists — on open if there already is one, and
    // after onboarding otherwise. SESSION_NETID=testnet switches it; unset means mainnet, and
    // there is deliberately no way to spell "offline" here: that is what SESSION_FAKE is for.
    netid: process.env['SESSION_NETID'] === 'testnet' ? 'testnet' : 'mainnet',
    deviceType: 'desktop',
  })
}
