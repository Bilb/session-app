import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createSessionClient } from '@session/client'
import { describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

const addon = join(import.meta.dirname, '../build/Release/session_bridge_node.node')

const describeAddon = existsSync(addon) ? describe : describe.skip

describeAddon('attachNetwork with no account yet', () => {
  it('refuses a netid it cannot attach to instead of keeping it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-netid-'))
    await mkdir(join(dir, 'cache'), { recursive: true })
    const client = createSessionClient(
      createNodeBridgeTransport({
        dbPath: join(dir, 'session.db'),
        cacheDir: join(dir, 'cache'),
        rawKey: new Uint8Array(32).fill(5),
        deferAccount: true,
      }),
    )

    try {
      await expect(client.attachNetwork('devnet')).rejects.toThrow(/devnet/)
      await expect(client.attachNetwork('nonsense')).rejects.toThrow(/mainnet or testnet/)

      // The refusal has to leave nothing behind. A netid kept here is one the next call that
      // brings an account into being throws on - onboarding failing at the step after the one
      // the user got wrong, naming a network nobody asked that screen about.
      await client.createAccount()
      const info = await client.getAccountInfo()
      expect(info.haveAccount).toBe(true)
      expect(info.networkAttached).toBe(false)
    } finally {
      client.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
