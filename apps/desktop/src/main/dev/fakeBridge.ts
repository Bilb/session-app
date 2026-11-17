import { constants, existsSync } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { BridgeTransport, DecodePlanner, MediaSource } from '@session/client'
import {
  createFakeMediaSource,
  fakeDecodePlan,
  createFakeTransport,
  startDevFake,
  type StagedHead,
} from '@session/client/fake'

/**
 * The folder of dev photographs the fake serves, filled by `pnpm fake-media:fetch`.
 *
 * Outside the repository on purpose: several megabytes of somebody else's photographs are not
 * something to commit. Unprefixed because it is a path on the host, read only by host processes -
 * this one, the fetch script and mobile's push script - and never by an app bundle.
 */
const MEDIA_DIR =
  process.env['SESSION_FAKE_MEDIA_DIR'] ?? join(homedir(), '.cache', 'session-app', 'dev-media')

/**
 * The first `count` bytes of a regular file, as the shim reads one: opened without blocking, so a
 * FIFO cannot stall the main process, and refused unless the opened file is a regular one.
 */
async function readHead(path: string, count: number): Promise<StagedHead> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const info = await file.stat()
    if (!info.isFile()) throw new Error('not a regular file')
    const head = new Uint8Array(count)
    const { bytesRead } = await file.read(head, 0, count, 0)
    return { head: head.subarray(0, bytesRead), size: info.size }
  } finally {
    await file.close()
  }
}

/**
 * The bridge, backed by the fake.
 *
 * This is a dev entry and lives here so the boundary rules can say so: production code
 * never imports the fake, and the dynamic import in ../bridge.ts is what keeps it out of a
 * shipped bundle.
 */
export function createFakeBridge(): BridgeTransport & MediaSource & DecodePlanner {
  const { alice, served } = startDevFake(process.env, {
    has: (fileName) => existsSync(join(MEDIA_DIR, fileName)),
    where: `in ${MEDIA_DIR}`,
    fix: 'pnpm fake-media:fetch',
  })

  alice.readStagedFilesWith({
    decodesHeic: process.platform === 'darwin',
    sizeOf: async (path) => (await readHead(path, 0)).size,
  })

  return {
    ...createFakeTransport(served),
    ...createFakeMediaSource(alice, (photo) => readFile(join(MEDIA_DIR, photo)), readHead),
    planDecode: fakeDecodePlan,
  }
}
