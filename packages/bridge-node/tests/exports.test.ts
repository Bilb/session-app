import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

/**
 * The addon exports the N-API entry points and nothing else: Electron on Linux has the system's
 * gnutls and nettle loaded, and an exported copy of ours binds to theirs, built for other headers.
 * Plain Node loads neither, so this is the check that sees it without an Electron process.
 */
const addon = join(import.meta.dirname, '../build/Release/session_bridge_node.node')
const describeElf = existsSync(addon) && process.platform === 'linux' ? describe : describe.skip

const ENTRY_POINTS = ['napi_register_module_v1', 'node_api_module_get_api_version_v1']

describeElf('the addon on Linux', () => {
  it('exports only the N-API entry points', async () => {
    const { stdout } = await promisify(execFile)('nm', ['-D', '--defined-only', addon])
    const exported = stdout
      .split('\n')
      .map((line) => line.trim().split(/\s+/).at(-1))
      .filter((name): name is string => name !== undefined && name !== '')
    expect(exported.sort()).toEqual([...ENTRY_POINTS].sort())
  })
})
