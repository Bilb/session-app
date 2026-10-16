import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { commitStamp, libsessionStamp } from '#src/index'

const made: string[] = []

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim()
}

/** A repository with one committed file, and its HEAD. */
function repo(): { dir: string; head: string } {
  const dir = mkdtempSync(join(tmpdir(), 'build-stamp-'))
  made.push(dir)
  git(dir, 'init', '-q')
  writeFileSync(join(dir, 'file'), 'one')
  git(dir, 'add', 'file')
  git(dir, 'commit', '-q', '-m', 'one')
  return { dir, head: git(dir, 'rev-parse', 'HEAD') }
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('commitStamp', () => {
  it('is the first eight characters of HEAD', () => {
    const { dir, head } = repo()
    expect(commitStamp(dir)).toBe(head.slice(0, 8))
  })

  it('says -dirty over an uncommitted change', () => {
    const { dir, head } = repo()
    writeFileSync(join(dir, 'file'), 'two')
    expect(commitStamp(dir)).toBe(`${head.slice(0, 8)}-dirty`)
  })

  it('is null outside a checkout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-stamp-'))
    made.push(dir)
    expect(commitStamp(dir)).toBeNull()
  })
})

describe('libsessionStamp', () => {
  it('is the pinned commit when the submodule was never checked out, not the app commit', () => {
    const app = repo()
    const pinned = 'a'.repeat(40)
    git(app.dir, 'update-index', '--add', '--cacheinfo', `160000,${pinned},libsession-util`)
    git(app.dir, 'commit', '-q', '-m', 'pin')
    mkdirSync(join(app.dir, 'libsession-util'))
    expect(libsessionStamp(app.dir)).toBe(pinned.slice(0, 8))
  })

  it("is the submodule's own commit where it is checked out", () => {
    const app = repo()
    const library = repo()
    git(
      app.dir,
      '-c',
      'protocol.file.allow=always',
      'submodule',
      'add',
      '-q',
      library.dir,
      'libsession-util',
    )
    git(app.dir, 'commit', '-q', '-m', 'add')
    expect(libsessionStamp(app.dir)).toBe(library.head.slice(0, 8))
  })
})
