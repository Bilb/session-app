import { closeSync, existsSync, openSync, readdirSync, readSync } from 'node:fs'
import { join } from 'node:path'

/** How a Git LFS pointer starts, which a checkout without LFS holds in place of each picture. */
const LFS_POINTER = 'version https://git-lfs.github.com/spec/v1'

function startOf(file: string): string {
  const head = Buffer.alloc(LFS_POINTER.length)
  const fd = openSync(file, 'r')
  try {
    return head.subarray(0, readSync(fd, head, 0, head.length, 0)).toString()
  } finally {
    closeSync(fd)
  }
}

/**
 * Fails where a baseline under `dir` is still an LFS pointer, which every comparison would
 * otherwise report as a picture that cannot be decoded.
 */
export function assertBaselinesPulled(dir: string): void {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const file = join(dir, name)
    if (name.endsWith('.png') && startOf(file) === LFS_POINTER)
      throw new Error(`baseline is an LFS pointer, run git lfs pull: ${file}`)
  }
}
