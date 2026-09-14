import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createSessionClient, discoverSeedNodes } from '@session/client'
import { describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

/**
 * Attaches one real bridge to a real local devnet, and says whether it worked.
 *
 * Not a test of anything - a tool, shaped as one because it needs the addon and vitest is what
 * already loads it. It answers the question neither the contract suite nor a unit test can: that
 * the seed nodes a devnet advertises are ones libsession can actually bootstrap from. Every
 * refusal is covered offline; only this covers an acceptance.
 *
 *     EXPO_PUBLIC_SESSION_DEVNET_SEED_URL=http://192.168.1.114:1280 \
 *       pnpm --filter @session/bridge-node exec vitest run tests/devnet
 *
 * Skipped without that variable, so `pnpm test` never opens a socket.
 */
const seedUrl = process.env['EXPO_PUBLIC_SESSION_DEVNET_SEED_URL']

describe.skipIf(seedUrl === undefined)('a local devnet', () => {
  it('attaches, and libsession says so', async () => {
    if (seedUrl === undefined) throw new Error('unreachable: the suite is skipped without it')

    const seedNodes = await discoverSeedNodes(seedUrl, {
      fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8_000) }),
      variable: 'EXPO_PUBLIC_SESSION_DEVNET_SEED_URL',
    })
    console.log(`discovered ${String(seedNodes.length)} seed node(s):`, seedNodes)
    expect(seedNodes.length).toBeGreaterThan(0)

    const dir = mkdtempSync(join(tmpdir(), 'session-devnet-'))
    mkdirSync(join(dir, 'cache'), { recursive: true })

    const client = createSessionClient(
      createNodeBridgeTransport({
        dbPath: join(dir, 'session.db'),
        cacheDir: join(dir, 'cache'),
        rawKey: new Uint8Array(32).fill(7),
        deferAccount: true,
        netid: 'devnet',
        seedNodes,
        deviceType: 'desktop',
        logLevel: 'info',
      }),
    )

    try {
      await client.createAccount()
      const info = await client.getAccountInfo()
      console.log(
        `devnet account ${info.sessionId ?? '(none)'}, attached ${String(info.networkAttached)}`,
      )
      expect(info.haveAccount).toBe(true)
      expect(info.networkAttached).toBe(true)
    } finally {
      client.close()
    }
  }, 120_000)

  it('carries a message between two accounts on it', async () => {
    if (seedUrl === undefined) throw new Error('unreachable: the suite is skipped without it')

    const seedNodes = await discoverSeedNodes(seedUrl, {
      fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8_000) }),
    })

    const open = (fill: number) => {
      const dir = mkdtempSync(join(tmpdir(), 'session-devnet-'))
      mkdirSync(join(dir, 'cache'), { recursive: true })
      return createSessionClient(
        createNodeBridgeTransport({
          dbPath: join(dir, 'session.db'),
          cacheDir: join(dir, 'cache'),
          rawKey: new Uint8Array(32).fill(fill),
          deferAccount: true,
          netid: 'devnet',
          seedNodes,
          deviceType: 'desktop',
        }),
      )
    }

    const alice = open(11)
    const bob = open(12)

    try {
      await alice.createAccount()
      await bob.createAccount()
      const bobId = (await bob.getAccountInfo()).sessionId ?? ''
      const aliceId = (await alice.getAccountInfo()).sessionId ?? ''
      console.log(`alice ${aliceId}\nbob   ${bobId}`)

      const body = `devnet round trip ${String(Date.now())}`
      const conversation = await alice.openDm(bobId)
      await alice.sendMessage(conversation, { body })

      // A real swarm and libsession's own poll ticker, so this waits rather than settling a
      // clock. The first attempt can fall inside the window where the router is still
      // bootstrapping, which is why the deadline is generous.
      const deadline = Date.now() + 90_000
      let arrived = false
      while (!arrived && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3_000))
        const messages = await bob.getMessages(aliceId)
        arrived = messages.some((message) => message.body === body)
      }

      console.log(`arrived at bob: ${String(arrived)}`)
      expect(arrived).toBe(true)
    } finally {
      alice.close()
      bob.close()
    }
  }, 180_000)
})
