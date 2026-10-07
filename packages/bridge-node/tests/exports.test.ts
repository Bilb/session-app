import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

/**
 * The addon exports the N-API entry points and nothing else. Electron on Linux has the system's
 * gnutls and nettle loaded, and an exported copy of ours binds to theirs, built for other headers;
 * macOS's dyld coalesces exported weak definitions across every image in the process. Plain Node
 * triggers neither, so this is the check that sees it without an Electron process.
 */
const addon = join(import.meta.dirname, '../build/Release/session_bridge_node.node')

const ENTRY_POINTS = ['napi_register_module_v1', 'node_api_module_get_api_version_v1']

const NM: Partial<Record<NodeJS.Platform, { args: Array<string>; prefix: string }>> = {
  linux: { args: ['-D', '--defined-only'], prefix: '' },
  // Mach-O prefixes C symbols with an underscore.
  darwin: { args: ['-gU'], prefix: '_' },
}
const nm = NM[process.platform]
const describeExports = existsSync(addon) && nm !== undefined ? describe : describe.skip

describeExports(`the addon on ${process.platform}`, () => {
  it('exports only the N-API entry points', async () => {
    const { args, prefix } = nm ?? expect.unreachable()
    const { stdout } = await promisify(execFile)('nm', [...args, addon])
    const exported = stdout
      .split('\n')
      .map((line) => line.trim().split(/\s+/).at(-1))
      .filter((name): name is string => name !== undefined && name !== '')
    expect(exported.sort()).toEqual(ENTRY_POINTS.map((name) => prefix + name).sort())
  })
})
