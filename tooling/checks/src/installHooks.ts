import { spawnSync } from 'node:child_process'

// A tarball or CI checkout without a .git has no hooks to install, and that must not fail install.
const inRepo = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' }).status === 0
if (inRepo) spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' })
