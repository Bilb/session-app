import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { pushedFiles } from '#src/files'

let repo: string | undefined

afterEach(() => {
  if (repo !== undefined) rmSync(repo, { recursive: true, force: true })
  repo = undefined
})

function git(...args: string[]): void {
  execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
}

describe('pushedFiles', () => {
  it('is the tracked files and the new ones git is not ignoring, less any deleted', () => {
    repo = mkdtempSync(join(tmpdir(), 'turbo-guard-'))
    git('init', '-q')
    for (const file of ['tracked.ts', 'deleted.ts', 'new.ts', 'ignored.ts', '.gitignore']) {
      writeFileSync(join(repo, file), file === '.gitignore' ? 'ignored.ts\n' : '')
    }
    git('add', 'tracked.ts', 'deleted.ts', '.gitignore')
    rmSync(join(repo, 'deleted.ts'))

    expect([...pushedFiles(repo)].sort()).toEqual(['.gitignore', 'new.ts', 'tracked.ts'])
  })
})
