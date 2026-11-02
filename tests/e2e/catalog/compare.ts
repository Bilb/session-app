import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { countByStatus, decodePng, hasDifferences, isBlank } from '#catalog/diff'
import {
  captureKey,
  EXIT,
  missingPages,
  parseCompareArgs,
  USAGE,
  UsageError,
  type CatalogTier,
  type CompareOptions,
} from '#catalog/options'
import { pageIdsIn, writeReport } from '#catalog/writeReport'

/**
 * `pnpm catalog:compare`: the catalog Argos diffs on a pull request, captured at a base and in the
 * working tree on this machine, so whatever this machine draws differently from Argos's Linux
 * captures is drawn on both sides and cancels out. Each side runs its own spec, as each side's
 * build does in CI. Every launch is hidden: see apps/desktop/src/main/hiddenRun.ts.
 */

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const outRoot = join(repoRoot, 'test-results', 'catalog-compare')
const cacheRoot = join(outRoot, 'cache')

/** The desktop main source that makes a hidden run; a base without it is given it. */
const HIDDEN_RUN_SOURCE = 'apps/desktop/src/main/hiddenRun.ts'
const DESKTOP_MAIN = 'apps/desktop/src/main'
const LOCALIZATION_SUBMODULE = 'packages/localization/src/localization-src'

/**
 * The longest a side's capture may take before Playwright stops it. The spec allows itself half an
 * hour, which a hidden window that never paints would spend waiting; a pr capture takes a minute
 * or two.
 */
const CAPTURE_LIMIT_MS: Record<CatalogTier, number> = { pr: 15 * 60_000, nightly: 60 * 60_000 }

/** Builds and captures share the machine with whoever is working on it. */
const NICE = ['nice', '-n', '10'] as const

/** A step that could not be done: its message is what the developer is told. */
class CompareFailure extends Error {}

/** Git's output as it printed it: a patch's last line can be a context line of one space. */
function gitRaw(args: readonly string[], cwd = repoRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function git(args: readonly string[], cwd = repoRoot): string {
  return gitRaw(args, cwd).trim()
}

function gitSucceeds(args: readonly string[], cwd = repoRoot): boolean {
  try {
    git(args, cwd)
    return true
  } catch {
    return false
  }
}

function seconds(since: number): string {
  return `${((Date.now() - since) / 1000).toFixed(0)}s`
}

/** Whether a step's child is running, which hears an interrupt itself and fails the step. */
let stepRunning = false

/** Runs a step with its output shown, failing the comparison with `what` if it fails. */
async function step(
  what: string,
  command: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv | undefined },
): Promise<number> {
  const started = Date.now()
  console.log(`\n▶ ${what}`)
  const [program = '', ...args] = command
  stepRunning = true
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (exitCode, signal) => {
      resolve(exitCode ?? (signal === null ? 1 : 128))
    })
  })
  stepRunning = false
  console.log(`  ${what}: ${code === 0 ? 'done' : `exit ${String(code)}`} in ${seconds(started)}`)
  return code
}

async function mustStep(
  what: string,
  command: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv | undefined },
): Promise<void> {
  if ((await step(what, command, options)) !== 0) throw new CompareFailure(`${what} failed`)
}

/** What a capture directory holds beside its pictures. */
interface CaptureRecord {
  sha: string
  tier: CatalogTier
  /** Whether every page the spec listed was written; null where the spec lists none. */
  complete: boolean | null
  /** The spec's own verdict, which includes the axe audit. */
  specPassed: boolean
  overlay: boolean
}

interface Capture {
  dir: string
  record: CaptureRecord
  cached: boolean
}

const pagesDir = (capture: string) => join(capture, 'pages')

/**
 * The change that made hidden runs, for a base from before it: the diff of desktop main in the
 * commit that added hiddenRun.ts. Null when the base has it already.
 */
function hiddenRunOverlay(baseSha: string): { patch: string; hash: string } | null {
  if (gitSucceeds(['cat-file', '-e', `${baseSha}:${HIDDEN_RUN_SOURCE}`])) return null
  const added = git([
    'log',
    '--diff-filter=A',
    '--format=%H',
    '-1',
    'HEAD',
    '--',
    HIDDEN_RUN_SOURCE,
  ])
  if (added === '')
    throw new CompareFailure(
      `${HIDDEN_RUN_SOURCE} is not in HEAD's history, so nothing can run hidden`,
    )
  const patch = gitRaw(['diff', `${added}^`, added, '--', DESKTOP_MAIN])
  return { patch, hash: createHash('sha256').update(patch).digest('hex').slice(0, 12) }
}

/** Builds what the catalog spec launches, as the catalog workflow does, and captures it. */
async function buildAndCapture(
  checkout: string,
  dir: string,
  record: Omit<CaptureRecord, 'complete' | 'specPassed'>,
  label: string,
): Promise<CaptureRecord> {
  if (!existsSync(join(checkout, 'node_modules/electron/dist')))
    throw new CompareFailure(
      `${label}: Electron's binary is missing; run node node_modules/electron/install.js in ${checkout}`,
    )
  if (!existsSync(join(checkout, LOCALIZATION_SUBMODULE, 'README.md')))
    throw new CompareFailure(
      `${label}: the localization submodule is not checked out; git submodule update --init ${LOCALIZATION_SUBMODULE}`,
    )
  await mustStep(
    `${label}: build @session/localization`,
    [...NICE, 'pnpm', '--filter', '@session/localization', 'build'],
    { cwd: checkout },
  )
  await mustStep(
    `${label}: build @session/desktop`,
    [...NICE, 'pnpm', '--filter', '@session/desktop', 'build'],
    { cwd: checkout },
  )
  // The fake refuses to start without its photographs; a no-op once they are cached.
  await mustStep(`${label}: dev photographs`, ['pnpm', 'fake-media:fetch'], { cwd: checkout })

  rmSync(dir, { recursive: true, force: true })
  mkdirSync(pagesDir(dir), { recursive: true })
  const manifest = join(dir, 'pages.json')
  const code = await step(
    `${label}: capture the ${record.tier} catalog, hidden`,
    [
      ...NICE,
      'pnpm',
      'exec',
      'playwright',
      'test',
      '--project',
      'catalog',
      '--reporter=line',
      `--global-timeout=${String(CAPTURE_LIMIT_MS[record.tier])}`,
    ],
    {
      cwd: join(checkout, 'tests/e2e'),
      env: {
        ...process.env,
        CATALOG_TIER: record.tier,
        CATALOG_OUT: pagesDir(dir),
        CATALOG_PAGES_OUT: manifest,
        SESSION_E2E_HIDDEN: '1',
      },
    },
  )

  const captured = pageIdsIn(pagesDir(dir))
  if (captured.length === 0)
    throw new CompareFailure(`${label}: the catalog spec wrote no pages (exit ${String(code)})`)
  if (captured.every((id) => isBlank(decodePng(readFileSync(join(pagesDir(dir), `${id}.png`))))))
    throw new CompareFailure(
      `${label}: every page came out a single colour, which is a window that never painted: ` +
        'hidden capture is not drawing on this machine',
    )
  let complete: boolean | null = null
  if (existsSync(manifest)) {
    const missing = missingPages(JSON.parse(readFileSync(manifest, 'utf8')) as string[], captured)
    if (missing.length > 0)
      throw new CompareFailure(
        `${label}: the spec stopped before ${String(missing.length)} page(s), starting at ${missing[0] ?? ''}`,
      )
    complete = true
  }
  return { ...record, complete, specPassed: code === 0 }
}

/**
 * A capture of `sha`, from the cache when there is one. Written beside its final place and moved
 * there once whole, so the cache never holds half a capture.
 */
async function cachedCapture(
  key: string,
  options: CompareOptions,
  make: (dir: string) => Promise<CaptureRecord>,
): Promise<Capture> {
  const dir = join(cacheRoot, key)
  const recordFile = join(dir, 'capture.json')
  if (!options.refresh && existsSync(recordFile))
    return {
      dir,
      record: JSON.parse(readFileSync(recordFile, 'utf8')) as CaptureRecord,
      cached: true,
    }
  const partial = `${dir}.partial`
  const record = await make(partial)
  writeFileSync(join(partial, 'capture.json'), JSON.stringify(record, null, 2))
  rmSync(dir, { recursive: true, force: true })
  renameSync(partial, dir)
  return { dir, record, cached: false }
}

/**
 * The base, checked out in a temporary worktree beside the repository, installed from pnpm's
 * store (cloned, so it costs neither the network nor the disk), built and captured.
 */
async function captureBase(
  sha: string,
  dir: string,
  overlay: { patch: string } | null,
  options: CompareOptions,
): Promise<CaptureRecord> {
  const worktree = join(tmpdir(), `session-catalog-base-${sha.slice(0, 12)}`)
  git(['worktree', 'prune'])
  if (existsSync(worktree)) {
    if (!gitSucceeds(['worktree', 'remove', '--force', worktree]))
      rmSync(worktree, { recursive: true, force: true })
    git(['worktree', 'prune'])
  }
  console.log(`\n▶ base: worktree at ${worktree}`)
  git(['worktree', 'add', '--detach', worktree, sha])
  try {
    if (overlay !== null) {
      console.log(`  base predates hidden runs: applying ${DESKTOP_MAIN}'s change from HEAD`)
      try {
        execFileSync('git', ['apply', '--3way'], {
          cwd: worktree,
          input: overlay.patch,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (error) {
        const said = (error as { stderr?: Buffer }).stderr?.toString().trim() ?? ''
        throw new CompareFailure(
          `the base's ${DESKTOP_MAIN} does not take the hidden-run change, so it cannot be ` +
            `captured without a window; compare against a newer base. git apply said: ${said}`,
        )
      }
    }
    await mustStep(
      'base: localization submodule',
      [
        'git',
        '-c',
        'protocol.file.allow=always',
        'submodule',
        'update',
        '--init',
        '--reference',
        join(repoRoot, LOCALIZATION_SUBMODULE),
        LOCALIZATION_SUBMODULE,
      ],
      { cwd: worktree },
    )
    // Both builds read the repo's .env; the same one on both sides, or a flag set in it differs.
    if (existsSync(join(repoRoot, '.env')))
      copyFileSync(join(repoRoot, '.env'), join(worktree, '.env'))
    await mustStep(
      'base: install',
      [...NICE, 'pnpm', 'install', '--frozen-lockfile', '--prefer-offline'],
      { cwd: worktree },
    )
    await mustStep('base: Electron binary', ['node', 'node_modules/electron/install.js'], {
      cwd: worktree,
    })
    return await buildAndCapture(
      worktree,
      dir,
      { sha, tier: options.tier, overlay: overlay !== null },
      'base',
    )
  } finally {
    if (options.keepWorktree) console.log(`  kept ${worktree}`)
    else if (!gitSucceeds(['worktree', 'remove', '--force', worktree]))
      console.warn(`  could not remove ${worktree}: git worktree remove --force ${worktree}`)
  }
}

function captureNotes(side: string, record: CaptureRecord, cached: boolean): string[] {
  const notes: string[] = []
  if (record.complete === null && !record.specPassed)
    notes.push(
      `The ${side} spec failed and lists no pages, so its capture cannot be confirmed whole: ` +
        'a page shown as added or removed may be one it did not reach.',
    )
  else if (!record.specPassed)
    notes.push(`The ${side} spec failed after capturing every page: its axe audit, most likely.`)
  if (cached) notes.push(`The ${side} capture is from the cache; --refresh captures it again.`)
  return notes
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return EXIT.same
  }
  const options = parseCompareArgs(argv)
  const started = Date.now()

  const baseRef = options.baseRef ?? 'origin/main'
  if (!gitSucceeds(['rev-parse', '--verify', `${baseRef}^{commit}`]))
    throw new CompareFailure(`${baseRef} is not a commit here; git fetch, or name another base`)
  const baseSha =
    options.baseRef === undefined
      ? git(['merge-base', 'HEAD', 'origin/main'])
      : git(['rev-parse', `${baseRef}^{commit}`])
  const baseLabel = options.baseRef ?? 'merge base with origin/main'
  const headSha = git(['rev-parse', 'HEAD'])
  const dirty = git(['status', '--porcelain', '--untracked-files=normal']) !== ''

  const overlay = hiddenRunOverlay(baseSha)
  const host = { tier: options.tier, platform: process.platform, arch: process.arch }
  const base = await cachedCapture(
    captureKey({ sha: baseSha, ...host, overlayHash: overlay?.hash }),
    options,
    (dir) => captureBase(baseSha, dir, overlay, options),
  )

  const captureHead = (dir: string) =>
    buildAndCapture(
      repoRoot,
      dir,
      { sha: headSha, tier: options.tier, overlay: false },
      'working tree',
    )
  // Uncommitted changes are captured as they are, and never cached: no commit names them.
  const head: Capture = dirty
    ? await (async () => {
        const dir = join(outRoot, 'working-tree')
        return { dir, record: await captureHead(dir), cached: false }
      })()
    : await cachedCapture(captureKey({ sha: headSha, ...host }), options, captureHead)

  console.log('\n▶ compare')
  const { results, file } = writeReport({
    beforeDir: pagesDir(base.dir),
    afterDir: pagesDir(head.dir),
    reportDir: join(outRoot, 'report'),
    base: {
      label: baseLabel,
      sha: baseSha,
      note:
        overlay === null ? undefined : 'given the hidden-run change to desktop main to capture it',
    },
    head: {
      label: dirty ? 'working tree, with uncommitted changes' : 'working tree',
      sha: headSha,
    },
    tier: options.tier,
    sensitivity: options.sensitivity,
    warnings: [
      ...captureNotes('base', base.record, base.cached),
      ...captureNotes('working tree', head.record, head.cached),
    ],
  })

  const counts = countByStatus(results)
  console.log(
    `\ncatalog:compare: ${String(counts.changed)} changed, ${String(counts.added)} added, ` +
      `${String(counts.removed)} removed, ${String(counts.unchanged)} unchanged ` +
      `(${baseSha.slice(0, 10)} → working tree) in ${seconds(started)}\n${file}`,
  )
  return hasDifferences(results) ? EXIT.different : EXIT.same
}

// During a step its child hears the interrupt too and exits, which fails the step and so removes
// the base's worktree on the way out; between steps there is nothing to wait for.
process.on('SIGINT', () => {
  if (!stepRunning) process.exit(130)
})

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    if (error instanceof UsageError) console.error(`${error.message}\n\n${USAGE}`)
    else
      console.error(
        `\ncatalog:compare failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    process.exit(EXIT.failed)
  },
)
