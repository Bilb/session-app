import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { writeGzip } from '#src/main/logExport'

const LOG = 'session-20261009T000000Z-0.log'

/** A log directory with one file, and an empty folder to export into. */
function scratch(): { logs: string; out: string } {
  const root = mkdtempSync(join(tmpdir(), 'log-export-'))
  const logs = join(root, 'logs')
  const out = join(root, 'out')
  mkdirSync(logs)
  mkdirSync(out)
  writeFileSync(join(logs, LOG), 'a line\n')
  return { logs, out }
}

describe('writeGzip', () => {
  it('replaces the chosen file once the export is whole, and leaves nothing beside it', async () => {
    const { logs, out } = scratch()
    const chosen = join(out, 'export.log.gz')
    writeFileSync(chosen, 'the file the person chose to replace')
    await writeGzip(chosen, logs, [{ text: 'header\n' }, { file: LOG }])
    expect(gunzipSync(readFileSync(chosen)).toString('utf8')).toBe('header\na line\n')
    expect(readdirSync(out)).toEqual(['export.log.gz'])
  })

  it('leaves the chosen file as it was when the export fails, and removes its partial', async () => {
    const { logs, out } = scratch()
    const chosen = join(out, 'export.log.gz')
    writeFileSync(chosen, 'theirs')
    // A folder where a log file should be: reading it fails partway through the export.
    const folder = 'session-20261009T000000Z-1.log'
    mkdirSync(join(logs, folder))
    await expect(
      writeGzip(chosen, logs, [{ text: 'header\n' }, { file: LOG }, { file: folder }]),
    ).rejects.toThrow()
    expect(readFileSync(chosen, 'utf8')).toBe('theirs')
    expect(readdirSync(out)).toEqual(['export.log.gz'])
  })

  it('writes under the next free partial name, and never opens one that is already there', async () => {
    const { logs, out } = scratch()
    const chosen = join(out, 'export.log.gz')
    writeFileSync(`${chosen}.sessiondl`, 'somebody else')
    await writeGzip(chosen, logs, [{ file: LOG }])
    expect(readFileSync(`${chosen}.sessiondl`, 'utf8')).toBe('somebody else')
    expect(gunzipSync(readFileSync(chosen)).toString('utf8')).toBe('a line\n')
    expect(readdirSync(out).sort()).toEqual(['export.log.gz', 'export.log.gz.sessiondl'])
  })
})
