import { createReadStream, existsSync } from 'node:fs'
import { open, rename, rm, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

import type { ExportPart } from '@session/logging'

/**
 * What an export is written as until it is whole, beside the path chosen for it: libsession's own
 * suffix for a download in progress, numbered when that is taken. Its own name rather than the
 * usual `.part`, since somebody's `report.log.gz.part` is a plausible file to find there and this
 * is not; and never the chosen path itself, which may be a file the person told the dialog to
 * replace and must survive an export that fails.
 */
const PARTIAL_SUFFIX = '.sessiondl'
/** As many numbered names as libsession tries before giving up. */
const MAX_PARTIAL_NAMES = 1000

/**
 * The first free partial name beside `path`, opened exclusively: claiming the name is the open, so
 * two exports to one path never share a partial, and no file that is already there is opened over.
 */
async function claimPartial(path: string): Promise<{ partial: string; handle: FileHandle }> {
  for (let n = 0; n < MAX_PARTIAL_NAMES; n += 1) {
    const partial = `${path}${PARTIAL_SUFFIX}${n === 0 ? '' : String(n)}`
    try {
      return { partial, handle: await open(partial, 'wx') }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw Object.assign(new Error('every partial export name is taken'), { code: 'EEXIST' })
}

/**
 * The parts, in order, through one gzip stream into `path`; log files are streamed off disk.
 * Written to a partial and moved onto `path` once whole, so `path` is untouched by a failure, and
 * the partial goes with it.
 */
export async function writeGzip(
  path: string,
  dir: string,
  parts: readonly ExportPart[],
): Promise<void> {
  async function* bytes(): AsyncGenerator<Buffer> {
    for (const part of parts) {
      if ('text' in part) yield Buffer.from(part.text, 'utf8')
      else if (existsSync(join(dir, part.file))) {
        for await (const chunk of createReadStream(join(dir, part.file))) yield chunk as Buffer
      }
    }
  }
  const { partial, handle } = await claimPartial(path)
  try {
    await pipeline(Readable.from(bytes()), createGzip({ level: 6 }), handle.createWriteStream())
    // Closed before the move, which Windows refuses for a file still open.
    await handle.close()
    await rename(partial, path)
  } catch (error) {
    await handle.close().catch(() => undefined)
    // Left where it will not delete - locked, or the folder has turned read-only - rather than its
    // error, which names the path, crossing to the renderer in place of this one.
    await rm(partial, { force: true }).catch(() => undefined)
    throw error
  }
}
