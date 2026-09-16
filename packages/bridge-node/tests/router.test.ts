import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Frame, RouterKind } from '@session/bridge-types'
import { describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

/**
 * Which transport libsession actually selected, read from its own log.
 *
 * A tool shaped as a test, like `devnet.test.ts`: it needs the addon, and it attaches a real
 * network, so it opens sockets to mainnet and testnet seed nodes and is skipped unless asked for.
 * The contract suite covers the refusals offline; only this covers an acceptance - that `router`
 * reaches libsession rather than being carried and dropped, which nothing above the shim can see.
 *
 *     SESSION_ROUTER_PROBE=1 pnpm --filter @session/bridge-node exec vitest run tests/router
 */
const enabled = process.env['SESSION_ROUTER_PROBE'] === '1'

/** libsession logs the choice once the network is configured; the message ends with a newline. */
const ROUTE = /route requests using ([^\n]+)/

async function routerFor(netid: 'mainnet' | 'testnet', router?: RouterKind): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'session-router-'))
  mkdirSync(join(dir, 'cache'), { recursive: true })
  const lines: string[] = []

  const transport = createNodeBridgeTransport({
    dbPath: join(dir, 'session.db'),
    cacheDir: join(dir, 'cache'),
    rawKey: new Uint8Array(32).fill(3),
    // An account is what makes the bridge attach, and attaching is what logs the choice.
    deferAccount: false,
    netid,
    ...(router === undefined ? {} : { router }),
    deviceType: 'desktop',
    logLevel: 'debug',
  })
  transport.setSink((frame: Frame) => {
    if (frame.type === 'event' && frame.event.type === 'log') lines.push(frame.event.message)
  })

  try {
    for (let i = 0; i < 40; i++) {
      const hit = lines.map((line) => ROUTE.exec(line)?.[1]).find(Boolean)
      if (hit !== undefined) return hit.trim()
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return '(libsession logged no routing choice)'
  } finally {
    transport.close()
  }
}

describe.skipIf(!enabled)('the routing choice libsession made', () => {
  it('defaults to Session Router on the public networks', async () => {
    expect(await routerFor('mainnet')).toBe('Session Router')
    expect(await routerFor('testnet')).toBe('Session Router')
  }, 60_000)

  it('takes onion requests when asked, on a network that ships Session Router', async () => {
    expect(await routerFor('mainnet', 'onion-requests')).toBe('Onion Requests')
    expect(await routerFor('testnet', 'onion-requests')).toBe('Onion Requests')
  }, 60_000)
})
