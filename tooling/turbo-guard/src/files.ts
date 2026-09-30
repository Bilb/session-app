import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The files the next push would carry: tracked ones, plus new files git is not ignoring.
 *
 * Tracked alone would pass a new file until it was committed, which is exactly the file a local
 * run is there to catch before CI sees it. A tracked file deleted from the tree is left out, since
 * the push will not carry it and reading it would throw.
 */
export function pushedFiles(repoRoot: string): Set<string> {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  return new Set(
    listed.split('\n').filter((path) => path !== '' && existsSync(join(repoRoot, path))),
  )
}
