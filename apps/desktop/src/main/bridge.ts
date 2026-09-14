import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import electron from 'electron'

import { netidForTransport, parseDevnetConfig, parseNetworkName } from '@session/basic-types'
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
 * safeStorage degrades to plaintext where there is no keyring - a bare Linux session, most
 * often - and says so. Encrypting anyway would be a claim we cannot keep; the fallback that
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
 * The repo-root `.env`, for a build run out of the checkout.
 *
 * Here rather than in a dev script because the same values have to reach `electron-vite dev`,
 * `preview`, the e2e harness and a bare `electron out/main/index.js`, and this is the only code
 * all four run. An explicit environment variable wins, which is what lets the harness pin
 * SESSION_FAKE whatever a developer keeps in their file.
 */
function loadDotEnv(): void {
  if (app.isPackaged) return
  const file = fileURLToPath(new URL('../../../../.env', import.meta.url))
  if (existsSync(file)) process.loadEnvFile(file)
}

/**
 * Moves a pre-per-network database into `mainnet/`.
 *
 * Everything used to sit directly in userData, which is now where the per-network directories
 * go, so without this an existing account becomes unreachable and the app offers onboarding for
 * a new one. The `-wal` matters as much as the database: leaving it behind loses whatever was in
 * it.
 */
function migrateLegacyLayout(root: string): void {
  const legacy = join(root, 'session.db')
  const target = join(root, 'mainnet')
  if (!existsSync(legacy) || existsSync(join(target, 'session.db'))) return

  mkdirSync(target, { recursive: true })
  for (const name of [
    'session.db',
    'session.db-wal',
    'session.db-shm',
    'db-key.bin',
    'attachments',
    'netcache',
  ]) {
    const from = join(root, name)
    if (existsSync(from)) renameSync(from, join(target, name))
  }
}

/**
 * Opens the bridge the renderer talks to.
 *
 * The fake is reached through a dynamic import from a dev-only module, so a production build
 * has no path to it at all. Everything above this file sees frames either way.
 */
export async function createBridge(): Promise<BridgeTransport> {
  loadDotEnv()

  if (process.env['EXPO_PUBLIC_SESSION_FAKE'] === '1') {
    const { createFakeBridge } = await import('./dev/fakeBridge')
    return createFakeBridge()
  }

  const { createNodeBridgeTransport } = await import('@session/bridge-node')
  const { discoverSeedNodes } = await import('@session/client')

  const name = parseNetworkName(process.env['EXPO_PUBLIC_SESSION_NETID'])
  const devnet =
    name === 'devnet'
      ? parseDevnetConfig(
          {
            seedUrl: process.env['EXPO_PUBLIC_SESSION_DEVNET_SEED_URL'],
            fileServerUrl: process.env['EXPO_PUBLIC_SESSION_FILE_SERVER_URL'],
            fileServerX25519Pubkey: process.env['EXPO_PUBLIC_SESSION_FILE_SERVER_X25519_PUBKEY'],
            proBackendUrl: process.env['EXPO_PUBLIC_SESSION_PRO_BACKEND_URL'],
            proBackendEd25519Pubkey: process.env['EXPO_PUBLIC_SESSION_PRO_BACKEND_ED25519_PUBKEY'],
          },
          'EXPO_PUBLIC_SESSION_',
        )
      : undefined

  const netid = netidForTransport(name, devnet)

  // Per network, so a devnet identity and a mainnet one can both exist and switching back loses
  // neither. libsession derives its own snode cache from the database's directory, which puts
  // that on the right side of the split too.
  const dir = join(app.getPath('userData'), name)
  migrateLegacyLayout(app.getPath('userData'))
  mkdirSync(dir, { recursive: true })

  const seedNodes =
    devnet === undefined
      ? undefined
      : await discoverSeedNodes(devnet.seedUrl, {
          fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8_000) }),
          variable: 'SESSION_DEVNET_SEED_URL',
        })

  if (devnet?.fileServer === undefined && name === 'devnet')
    console.warn(
      'SESSION_FILE_SERVER_URL is unset on a devnet build: attachments would upload to the mainnet file server.',
    )
  if (devnet?.proBackend !== undefined)
    console.warn(
      `SESSION_PRO_BACKEND_URL is set and nothing reads it: libsession fixes the Pro backend at build time and this app has no Pro code.`,
    )

  return createNodeBridgeTransport({
    dbPath: join(dir, 'session.db'),
    cacheDir: join(dir, 'attachments'),
    rawKey: resolveDatabaseKey(dir),
    // Onboarding has to be asked. Without this libsession creates an account as the database
    // opens, and the first screen the user sees is a conversation list for an identity nobody
    // chose.
    deferAccount: true,
    // The bridge attaches this once an account exists - on open if there already is one, and
    // after onboarding otherwise. SESSION_NETID picks it; unset means mainnet, and there is
    // deliberately no way to spell "offline" here: that is what SESSION_FAKE is for.
    ...(netid === undefined ? {} : { netid }),
    ...(seedNodes === undefined ? {} : { seedNodes }),
    ...(devnet?.fileServer === undefined ? {} : { fileServer: devnet.fileServer }),
    deviceType: 'desktop',
    // Off unless asked for: it is chatty at anything below warn, and the reason to turn it up
    // is always a specific failure. SESSION_LOG=debug is what a diagnosis looks like.
    ...(process.env['EXPO_PUBLIC_SESSION_LOG'] === undefined
      ? {}
      : { logLevel: process.env['EXPO_PUBLIC_SESSION_LOG'] as 'debug' }),
  })
}
