import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'

import {
  MAX_STAGED_READ_BYTES,
  MEDIA_URL_VECTORS,
  runMediaSourceContract,
  SERVABLE_VECTORS,
  type MediaSourceHarness,
  type MediaUrlVector,
} from '@session/client-contract'
import { PHOTO_THUMBHASHES } from '@session/client/fake'
import jpeg from 'jpeg-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

import { builtForTesting, openPeer } from './peer'

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
  'needs a file server to fetch an incoming attachment from; the harness forges pointers only'

const NEEDS_TEST_COMMANDS = 'needs the test commands: build:native:testing'

const forges = builtForTesting()

function grey(width: number, height: number): Uint8Array {
  return jpeg.encode({ width, height, data: new Uint8Array(width * height * 4).fill(0x80) }, 90)
    .data
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/** A grey 8-bit RGB PNG, since libsession is handed a real one to decode. */
function greyPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.alloc(1 + width * 3, 0x80)
  row[0] = 0
  const rows = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', new Uint8Array()),
  ])
}

describeAddon('addon', () => {
  let root: string
  let sequence = 0
  const open: { close: () => void }[] = []

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'session-media-'))
  })

  afterAll(async () => {
    for (const transport of open) transport.close()
    await rm(root, { recursive: true, force: true })
  })

  async function stagedPeer() {
    sequence += 1
    const dir = join(root, `staged-${String(sequence)}`)
    await mkdir(dir, { recursive: true })
    const peer = await openPeer(join(dir, 'peer'), { deferred: true })
    open.push(peer.client)
    // A name outside ASCII, since the path crosses the addon and the url as UTF-8.
    const files = {
      jpeg: join(dir, '\u00e9t\u00e9 \u65e5\u672c.jpg'),
      png: join(dir, 'scan.png'),
      document: join(dir, 'paper.pdf'),
      missing: join(dir, 'gone.jpg'),
      oversized: join(dir, 'panorama.jpg'),
    }
    await writeFile(files.jpeg, grey(1280, 960))
    // Sparse: a real JPEG's head, and past the largest staged file read in length alone.
    await writeFile(files.oversized, grey(64, 48))
    await truncate(files.oversized, MAX_STAGED_READ_BYTES + 1)
    await writeFile(files.png, greyPng(300, 200))
    await writeFile(files.document, '%PDF-1.7\n')
    const fifo = join(dir, 'fifo.jpg')
    const device = join(dir, 'zero.jpg')
    execFileSync('mkfifo', [fifo])
    await symlink('/dev/zero', device)
    return { peer, files: { ...files, notRegular: [dir, fifo, device] } }
  }

  const harness: MediaSourceHarness = {
    async withAttachments() {
      sequence += 1
      const recipient = await openPeer(join(root, `recipient-${String(sequence)}`))
      const sender = await openPeer(join(root, `sender-${String(sequence)}`))
      open.push(recipient.client, sender.client)

      const hash = PHOTO_THUMBHASHES[0]
      if (hash === undefined) throw new Error('the fake has no photo hashes')
      const body = 'two pictures, one hashed, a PDF, an AVIF and an original file'
      const delivered = await recipient.ask({
        type: 'deliverTestMessage',
        senderSeedHex: sender.seed,
        body,
        timestamp: Date.now(),
        attachments: [
          { contentType: 'image/png', thumbhash: Buffer.from(hash, 'hex') },
          { contentType: 'image/png' },
          { contentType: 'application/pdf' },
          { contentType: 'image/avif' },
          { contentType: 'image/png', originalFile: true },
        ],
      })
      if (delivered.error !== undefined) throw new Error(delivered.error)

      const page = await recipient.client.getMessages(sender.sessionId, { limit: 10 })
      const message = page.messages.find((m) => m.body === body)
      if (!message) throw new Error('the forged message did not arrive')
      return {
        source: recipient.transport,
        client: recipient.client,
        conversationId: sender.sessionId,
        picture: { messageId: message.id, index: 0 },
        unhashed: { messageId: message.id, index: 1 },
        document: { messageId: message.id, index: 2 },
        avif: { messageId: message.id, index: 3 },
        original: { messageId: message.id, index: 4 },
        settle: () => Promise.resolve(),
      }
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

    async staged() {
      const { peer, files } = await stagedPeer()
      return { source: peer.transport, client: peer.client, ...files }
    },
  }

  it('closes while staged thumbnails are being made, rejecting each rather than answering late', async () => {
    const { peer, files } = await stagedPeer()
    const asked = Array.from({ length: 8 }, () => peer.transport.fetchStagedThumbnail(files.jpeg))
    peer.transport.close()
    const settled = await Promise.allSettled(asked)
    for (const outcome of settled) {
      if (outcome.status === 'rejected') expect(String(outcome.reason)).toContain('closed')
    }
    expect(settled.some((outcome) => outcome.status === 'rejected')).toBe(true)
  })

  runMediaSourceContract(
    harness,
    { describe, it, expect },
    {
      unsupported: {
        'answers a downloaded picture with its bytes and the type they were sent as':
          OFFLINE_ATTACHMENTS,
        'answers a downloaded picture with a square JPEG thumbnail no larger than the edge':
          OFFLINE_ATTACHMENTS,
        'has no thumbnail or rendition of a downloaded PDF': OFFLINE_ATTACHMENTS,
        'answers a downloaded picture with a JPEG or WebP rendition within the edge':
          OFFLINE_ATTACHMENTS,
        'thumbnails a downloaded original file but makes no rendition of it': OFFLINE_ATTACHMENTS,
        'answers a downloaded AVIF with a JPEG thumbnail, though no viewer here opens one':
          OFFLINE_ATTACHMENTS,
        ...(forges
          ? {}
          : {
              'answers a thumbhash as width * height RGBA pixels where the sender sent a hash':
                NEEDS_TEST_COMMANDS,
              'has no thumbhash where the sender sent no hash': NEEDS_TEST_COMMANDS,
              'has no thumbnail of a picture not yet downloaded': NEEDS_TEST_COMMANDS,
              'has no rendition of a picture not yet downloaded': NEEDS_TEST_COMMANDS,
              'marks a picture its sender sent as the original file': NEEDS_TEST_COMMANDS,
              'refuses a picture that is not downloaded, and starts no transfer':
                NEEDS_TEST_COMMANDS,
            }),
      },
    },
  )
})
