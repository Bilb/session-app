import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  MEDIA_URL_VECTORS,
  runMediaSourceContract,
  SERVABLE_VECTORS,
  type MediaSourceHarness,
  type MediaUrlVector,
} from '@session/client-contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createNodeBridgeTransport, type NodeBridgeTransport } from '#src/index'

/**
 * The shim's media rules and the addon's media source, against the vectors and the contract the
 * TypeScript and the fake answer. Skipped when the addon has not been built, as addon.test.ts is.
 */
const addon = join(import.meta.dirname, '../build/Release/session_bridge_node.node')
const describeAddon = existsSync(addon) ? describe : describe.skip

interface MediaRules {
  parseMediaUrl(url: string): MediaUrlVector['parsed']
  servableContentType(declared: string, bytes: Uint8Array): string | null
}

describeAddon('the shim media rules', () => {
  // A skipped suite still runs its body to collect tests, so the load waits for beforeAll.
  let rules: MediaRules
  beforeAll(() => {
    rules = createRequire(import.meta.url)(addon) as MediaRules
  })

  it('parse media urls as every parser of the scheme does', () => {
    for (const { url, parsed } of MEDIA_URL_VECTORS) {
      expect(rules.parseMediaUrl(url), url).toEqual(parsed)
    }
  })

  it('serve and refuse bytes as every servable check does', () => {
    for (const { declared, bytes, served } of SERVABLE_VECTORS) {
      expect(
        rules.servableContentType(declared, bytes),
        `${declared} ${String(bytes.length)}`,
      ).toBe(served)
    }
  })
})

const OFFLINE_ATTACHMENTS =
  'needs an incoming attachment and a file server to fetch it from; the harness forges bodies only'

describeAddon('addon', () => {
  let root: string
  let sequence = 0
  const open: NodeBridgeTransport[] = []

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'session-media-'))
  })

  afterAll(async () => {
    for (const transport of open) transport.close()
    await rm(root, { recursive: true, force: true })
  })

  const harness: MediaSourceHarness = {
    withAttachments() {
      return Promise.reject(
        new Error('the offline addon harness cannot produce an incoming attachment'),
      )
    },

    async empty() {
      sequence += 1
      const dir = join(root, `empty-${String(sequence)}`)
      await mkdir(join(dir, 'cache'), { recursive: true })
      const transport = createNodeBridgeTransport({
        dbPath: join(dir, 'session.db'),
        cacheDir: join(dir, 'cache'),
        rawKey: new Uint8Array(32).fill(5),
        deferAccount: true,
      })
      open.push(transport)
      return { source: transport }
    },
  }

  runMediaSourceContract(
    harness,
    { describe, it, expect },
    {
      unsupported: {
        'answers a picture with its bytes and the type they were sent as': OFFLINE_ATTACHMENTS,
        'reports a picture as cached once its bytes have been served': OFFLINE_ATTACHMENTS,
        'answers a preview as width * height RGBA pixels where the sender sent a hash':
          OFFLINE_ATTACHMENTS,
        'has no preview where the sender sent no hash': OFFLINE_ATTACHMENTS,
      },
    },
  )
})
