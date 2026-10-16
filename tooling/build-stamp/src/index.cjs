// CommonJS, and plain JavaScript, because Metro loads its config with `require` and neither
// bundler's config loader compiles workspace TypeScript.
const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

/** @param {string} cwd @param {string[]} args */
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/**
 * The commit a checkout is at: eight characters, and `-dirty` over uncommitted changes.
 *
 * A submodule counts only if its pointer moved, not for work inside it. Null outside a git
 * checkout, where there is nothing honest to say.
 *
 * @param {string} cwd
 * @returns {string | null}
 */
function commitStamp(cwd) {
  try {
    const commit = git(cwd, 'rev-parse', 'HEAD').trim().slice(0, 8)
    const dirty =
      git(
        cwd,
        'status',
        '--porcelain',
        '--untracked-files=no',
        '--ignore-submodules=dirty',
      ).trim() !== ''
    return dirty ? `${commit}-dirty` : commit
  } catch {
    return null
  }
}

/**
 * The libsession commit, stamped like the app's.
 *
 * From the submodule's own checkout where there is one, since that is what was built, and mid-bump
 * it can differ from the commit the app pins. A submodule never checked out is an empty directory
 * inside the app's checkout, where git answers with the app's own commit, so there the stamp is
 * the commit the app pins instead.
 *
 * @param {string} repoRoot
 * @returns {string | null}
 */
function libsessionStamp(repoRoot) {
  const submodule = path.join(repoRoot, 'libsession-util')
  if (existsSync(path.join(submodule, '.git'))) return commitStamp(submodule)
  try {
    return git(repoRoot, 'rev-parse', 'HEAD:libsession-util').trim().slice(0, 8)
  } catch {
    return null
  }
}

module.exports = { commitStamp, libsessionStamp }
