import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  isInChosenFolder,
  MAX_PATH_CHARS,
  MAX_SUGGESTED_NAME_CHARS,
  sanitiseSuggestedName,
} from '#src/main/files'

/**
 * What the renderer is allowed to hand the operating system.
 *
 * `showItemInFolder` acts on a path the page supplied, and the page is not trusted to have
 * checked one - the same standard `open-external` holds itself to. The rule is that a path has
 * to sit in a folder somebody pointed at in a save dialog this run.
 */
describe('a path the page asks to reveal', () => {
  const chosen = new Set(['/home/someone/Documents'])

  it('is allowed inside a folder that was chosen', () => {
    expect(isInChosenFolder('/home/someone/Documents/itinerary.pdf', chosen)).toBe(true)
  })

  it('is allowed under the name a collision produced', () => {
    // The path that comes back is not the path that went out: a save that collides becomes
    // `name (2)`, so matching whole paths would refuse the file that was just written.
    expect(isInChosenFolder('/home/someone/Documents/itinerary (2).pdf', chosen)).toBe(true)
  })

  it('is refused anywhere else', () => {
    expect(isInChosenFolder('/etc/passwd', chosen)).toBe(false)
    expect(isInChosenFolder('/home/someone/.ssh/id_ed25519', chosen)).toBe(false)
  })

  it('is refused in a folder that merely looks like one that was chosen', () => {
    // A prefix test would pass these. The comparison is the whole directory, not its start.
    expect(isInChosenFolder('/home/someone/Documents-old/x.pdf', chosen)).toBe(false)
    expect(isInChosenFolder('/home/someone/Documents/nested/x.pdf', chosen)).toBe(false)
  })

  it('is resolved before it is compared', () => {
    expect(isInChosenFolder('Downloads/itinerary.pdf', new Set([resolve('Downloads')]))).toBe(true)
    expect(isInChosenFolder('/home/someone/Documents/../Documents/x.pdf', chosen)).toBe(true)
    expect(isInChosenFolder('/home/someone/Documents/../.ssh/id_ed25519', chosen)).toBe(false)
  })

  it('ignores case only where paths are case-insensitive', () => {
    expect(isInChosenFolder('/home/someone/documents/x.pdf', chosen, true)).toBe(true)
    expect(isInChosenFolder('/home/someone/documents/x.pdf', chosen, false)).toBe(false)
  })

  it('is refused before anybody has chosen anything', () => {
    expect(isInChosenFolder('/home/someone/Documents/itinerary.pdf', new Set())).toBe(false)
  })

  it('is refused when it is longer than any real path', () => {
    const folder = '/home/someone/Documents/'
    const longest = folder + 'x'.repeat(MAX_PATH_CHARS - folder.length)
    expect(isInChosenFolder(longest, chosen)).toBe(true)
    expect(isInChosenFolder(longest + 'x', chosen)).toBe(false)
  })

  it('is refused when it is not a path at all', () => {
    for (const nonsense of ['', null, undefined, 42, {}]) {
      expect(isInChosenFolder(nonsense, chosen)).toBe(false)
    }
  })

  it('follows a symlink to compare by the real folder, not by name', () => {
    // A chosen folder reached through one name and a candidate path through another must be
    // recognised as the same folder - and a candidate that resolves somewhere else must not,
    // even where the two names happen to look alike.
    const root = mkdtempSync(join(tmpdir(), 'session-app-files-test-'))
    const real = join(root, 'real')
    const elsewhere = join(root, 'elsewhere')
    mkdirSync(real)
    mkdirSync(elsewhere)
    const alias = join(root, 'alias')
    symlinkSync(real, alias)

    expect(isInChosenFolder(join(real, 'x.pdf'), new Set([alias]))).toBe(true)
    expect(isInChosenFolder(join(elsewhere, 'x.pdf'), new Set([alias]))).toBe(false)
  })
})

describe('the name a save dialog is pre-filled with', () => {
  it('keeps an ordinary name as it is', () => {
    expect(sanitiseSuggestedName('itinerary (final).pdf')).toBe('itinerary (final).pdf')
  })

  it('drops any directory the sender put in front of it', () => {
    expect(sanitiseSuggestedName('../../.ssh/authorized_keys')).toBe('authorized_keys')
    expect(sanitiseSuggestedName('/etc/passwd')).toBe('passwd')
    expect(sanitiseSuggestedName('C:\\Windows\\x.dll')).toBe('x.dll')
    expect(sanitiseSuggestedName('..\\..\\startup/run.bat')).toBe('run.bat')
  })

  it('drops control characters', () => {
    expect(sanitiseSuggestedName('in\u0000voice\u001b[31m.pdf\u007f\n')).toBe('invoice[31m.pdf')
  })

  it('falls back rather than trimming a name longer than a filesystem allows', () => {
    const longest = 'x'.repeat(MAX_SUGGESTED_NAME_CHARS)
    expect(sanitiseSuggestedName(longest)).toBe(longest)
    expect(sanitiseSuggestedName(longest + 'x')).toBe('attachment')
  })

  it('falls back when nothing usable is left', () => {
    for (const nothing of ['', '   ', '.', '..', '../..', 'folder/', '\u0000\u0001', null, 42]) {
      expect(sanitiseSuggestedName(nothing)).toBe('attachment')
    }
  })
})
