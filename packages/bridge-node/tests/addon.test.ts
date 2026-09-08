import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { FrameSchema, RequestSchema } from '@session/proto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

/**
 * The addon against the real libsession, with no network attached.
 *
 * Skipped when the addon has not been built, because the per-PR job compiles no C++ - the
 * native workflow is where this runs. `turbo build:native` is what makes it run here.
 */
const addon = join(import.meta.dirname, '../build/Release/session_bridge_node.node')
const describeAddon = existsSync(addon) ? describe : describe.skip

describeAddon('the N-API addon', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'session-bridge-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('opens a database and answers on the frame stream', async () => {
    const transport = createNodeBridgeTransport({
      dbPath: join(dir, 'session.db'),
      cacheDir: join(dir, 'cache'),
      rawKey: new Uint8Array(32).fill(7),
      deferAccount: true,
    })

    const frames: Uint8Array[] = []
    const answered = new Promise<void>((resolve) => {
      transport.setSink((frame) => {
        frames.push(frame)
        const decoded = fromBinary(FrameSchema, frame)
        if (decoded.kind.case === 'response' && decoded.kind.value.requestId === 1) resolve()
      })
    })

    transport.send(
      toBinary(
        RequestSchema,
        create(RequestSchema, { id: 1, cmd: { case: 'getAccountInfo', value: {} } }),
      ),
    )

    await answered

    const response = frames
      .map((frame) => fromBinary(FrameSchema, frame))
      .find((frame) => frame.kind.case === 'response')
    expect(response?.kind.case).toBe('response')

    if (response?.kind.case !== 'response') throw new Error('no response frame')
    expect(response.kind.value.error).toBeUndefined()
    expect(response.kind.value.result.case).toBe('accountInfo')

    if (response.kind.value.result.case !== 'accountInfo') throw new Error('wrong result')
    // deferAccount is what makes this false. Without it libsession creates an account as the
    // database opens, and onboarding never gets asked.
    expect(response.kind.value.result.value.haveAccount).toBe(false)

    transport.close()
  })

  it('creates an account when it is not asked to defer', async () => {
    const transport = createNodeBridgeTransport({
      dbPath: join(dir, 'eager.db'),
      cacheDir: join(dir, 'cache'),
      rawKey: new Uint8Array(32).fill(3),
      deferAccount: false,
    })

    const info = new Promise<{ haveAccount: boolean; sessionId: string | undefined }>((resolve) => {
      transport.setSink((frame) => {
        const decoded = fromBinary(FrameSchema, frame)
        if (decoded.kind.case !== 'response') return
        const result = decoded.kind.value.result
        if (result.case === 'accountInfo')
          resolve({ haveAccount: result.value.haveAccount, sessionId: result.value.sessionId })
      })
    })

    transport.send(
      toBinary(
        RequestSchema,
        create(RequestSchema, { id: 3, cmd: { case: 'getAccountInfo', value: {} } }),
      ),
    )

    const account = await info
    expect(account.haveAccount).toBe(true)
    expect(account.sessionId).toMatch(/^05[0-9a-f]{64}$/)

    transport.close()
  })

  it('reports a command libsession has no counterpart for, rather than failing silently', async () => {
    const transport = createNodeBridgeTransport({
      dbPath: join(dir, 'second.db'),
      cacheDir: join(dir, 'cache'),
      rawKey: new Uint8Array(32).fill(9),
      deferAccount: false,
    })

    const answered = new Promise<string | undefined>((resolve) => {
      transport.setSink((frame) => {
        const decoded = fromBinary(FrameSchema, frame)
        if (decoded.kind.case === 'response' && decoded.kind.value.requestId === 2)
          resolve(decoded.kind.value.error)
      })
    })

    transport.send(
      toBinary(
        RequestSchema,
        create(RequestSchema, {
          id: 2,
          cmd: { case: 'approveConversation', value: { conversationId: '05' + '00'.repeat(32) } },
        }),
      ),
    )

    await expect(answered).resolves.toContain('approveConversation')
    transport.close()
  })
})
