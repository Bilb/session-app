import { execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { win32 } from 'node:path'

// Named imports do not survive the ESM loader here; see the note in index.ts.
import electron from 'electron'

const { app } = electron

/**
 * How `userData` -- the database, the attachments, the logs -- is kept off other machines.
 *
 * - **macOS:** excluded from Time Machine, which otherwise copies Application Support.
 * - **Windows:** in Local AppData rather than Roaming, which a domain's roaming profile syncs to
 *   every machine the account signs in to.
 * - **Linux:** nothing. There is no standard backup to opt out of.
 */
export type BackupExclusion = 'time-machine' | 'local-appdata' | 'none'

/**
 * Where `userData` belongs on this platform, or null for Electron's default, and how it is kept
 * out of backups. Pure, with the environment passed in, so it can be tested anywhere.
 *
 * Windows falls back to the conventional Local AppData under the home directory when the variable
 * is missing, rather than to Roaming, which is the one place it must not go.
 */
export function userDataPlacement(input: {
  platform: NodeJS.Platform
  env: Readonly<Record<string, string | undefined>>
  home: string
  /** `app.getName()`, which Electron's own default ends in too. */
  name: string
}): { path: string | null; exclusion: BackupExclusion } {
  switch (input.platform) {
    case 'darwin':
      return { path: null, exclusion: 'time-machine' }
    case 'win32': {
      const local = input.env['LOCALAPPDATA'] || win32.join(input.home, 'AppData', 'Local')
      return { path: win32.join(local, input.name), exclusion: 'local-appdata' }
    }
    default:
      return { path: null, exclusion: 'none' }
  }
}

/**
 * The startup block's row: what is asked for. Time Machine's answer comes later, as a line of its
 * own: `tmutil` can take seconds, and the block is not held for it.
 */
export function backupRow(exclusion: BackupExclusion): [string, string] {
  switch (exclusion) {
    case 'time-machine':
      return ['Backup', 'excluded from Time Machine (asked at launch; the answer is logged)']
    case 'local-appdata':
      return ['Backup', 'Local AppData, not roaming']
    case 'none':
      return ['Backup', 'no exclusion on this platform']
  }
}

let placement: ReturnType<typeof userDataPlacement> | null = null
let excluded: Promise<string | null> | null = null

/**
 * Moves `userData` where it belongs. **Before anything reads a path**, as `setName` is: Electron
 * resolves `userData` on first use and then keeps it.
 */
export function placeUserData(): void {
  placement = userDataPlacement({
    platform: process.platform,
    env: process.env,
    home: app.getPath('home'),
    name: app.getName(),
  })
  if (placement.path !== null) app.setPath('userData', placement.path)
}

/**
 * Asks Time Machine to skip `userData` on macOS; resolves to why it could not, or null.
 *
 * `tmutil addexclusion` without `-p` sets the sticky exclusion: an extended attribute on the
 * directory itself, which travels with it and needs no root. Set at every launch because it is
 * cheap and because a directory recreated by hand loses it. Failure is reported, never thrown: an
 * app that will not start because it could not opt out of a backup protects nothing.
 */
export function excludeUserData(): Promise<string | null> {
  excluded ??= new Promise((resolve) => {
    if (placement?.exclusion !== 'time-machine') {
      resolve(null)
      return
    }
    const userData = app.getPath('userData')
    try {
      mkdirSync(userData, { recursive: true })
    } catch (error) {
      resolve(error instanceof Error ? error.message : String(error))
      return
    }
    execFile('/usr/bin/tmutil', ['addexclusion', userData], { timeout: 10_000 }, (error) => {
      resolve(error === null ? null : error.message.trim())
    })
  })
  return excluded
}

/** What `placeUserData` decided, for the startup block. */
export function userDataExclusion(): BackupExclusion {
  return placement?.exclusion ?? 'none'
}
