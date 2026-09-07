import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Command } from '@session/bridge-types'
import { describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

/**
 * Sends one real message to one real account, over a real network.
 *
 * Not a test of anything - a tool, shaped as one because it needs the addon and the protocol
 * types, and vitest is what already loads them. It exists because verifying that an app *receives*
 * requires something to send, and a second bridge is a truer sender than a fixture: the
 * message is built, encrypted and stored by the same libsession the app is reading.
 *
 *     SESSION_SEND_TO=05… pnpm --filter @session/bridge-node exec vitest run src/sendTestMessage
 *
 * Skipped without that variable, so `pnpm test` never opens a socket. It mints its own throwaway
 * account on first use, which is what makes the message arrive as a message request.
 */
const target = process.env['SESSION_SEND_TO']

describe.skipIf(target === undefined)('sending a test message', () => {
  it('writes one message to the account in SESSION_SEND_TO', async () => {
    if (target === undefined) throw new Error('unreachable: the suite is skipped without it')
    const body = process.env['SESSION_SEND_BODY'] ?? 'hello from the network'

    // Reused between runs when given, so the same sender keeps its identity and its second
    // message lands in the conversation rather than as another request.
    const dir = process.env['SESSION_SEND_DIR'] ?? mkdtempSync(join(tmpdir(), 'session-sender-'))
    mkdirSync(join(dir, 'cache'), { recursive: true })

    const transport = createNodeBridgeTransport({
      dbPath: join(dir, 'session.db'),
      cacheDir: join(dir, 'cache'),
      rawKey: new Uint8Array(32).fill(9),
      deferAccount: true,
      netid: process.env['SESSION_NETID'] === 'testnet' ? 'testnet' : 'mainnet',
      deviceType: 'desktop',
    })

    type Answer = { error?: string; result: string; haveAccount?: boolean }
    const waiting = new Map<number, (v: Answer) => void>()
    transport.setSink((frame) => {
      if (frame.type !== 'response') return
      const done = waiting.get(frame.response.id)
      if (!done) return
      waiting.delete(frame.response.id)
      const r = frame.response.result
      done({
        ...(frame.response.error === undefined ? {} : { error: frame.response.error }),
        result: r?.type ?? 'none',
        ...(r?.type === 'accountInfo' ? { haveAccount: r.info.haveAccount } : {}),
      })
    })

    let next = 1
    const ask = (command: Command) =>
      new Promise<Answer>((resolve) => {
        const id = next++
        waiting.set(id, resolve)
        transport.send({ id, command })
      })

    const info = await ask({ type: 'getAccountInfo' })
    console.log('sender account info:', JSON.stringify(info))
    if (!info.haveAccount) {
      const created = await ask({ type: 'createAccount' })
      console.log('createAccount:', JSON.stringify(created))
    }

    const opened = await ask({ type: 'openDm', sessionId: target })
    console.log('openDm:', JSON.stringify(opened))

    const sent = await ask({ type: 'sendMessage', conversationId: target, body, attachments: [] })
    console.log('sendMessage:', JSON.stringify(sent))

    // The send is two-stage and the bridge going away takes the queue with it, so this waits
    // for the swarm to have accepted it rather than for the call to have returned.
    await new Promise((r) => setTimeout(r, Number(process.env['SESSION_SEND_SETTLE_MS'] ?? 20000)))
    transport.close()
    expect(sent.error).toBeUndefined()
  }, 120000)
})
