import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const stateFile = join(repoRoot, 'test-results', 'metro.json')
const logFile = join(repoRoot, 'test-results', 'metro.log')

/** Metro's port on the harness host; a device reaches it as `10.0.2.2` or `localhost`. */
export const METRO_PORT = Number(process.env['SESSION_E2E_METRO_PORT'] ?? '8081')

const START_TIMEOUT_MS = 120_000
const STOP_TIMEOUT_MS = 30_000
/** A cold transform of the whole app, which the first device to ask would otherwise wait on. */
const WARM_TIMEOUT_MS = 600_000

interface Running {
  pid: number
  port: number
  key: string
}

const keyOf = (env: Readonly<Record<string, string>>) =>
  createHash('sha256')
    .update(JSON.stringify(Object.entries(env).sort(([a], [b]) => a.localeCompare(b))))
    .digest('hex')

function readState(): Running | null {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8')) as Running
  } catch {
    return null
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function status(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/status`, {
      signal: AbortSignal.timeout(2_000),
    })
    return (await response.text()).includes('running')
  } catch {
    return false
  }
}

/** Stops the Metro this harness started, if one is running; what `globalTeardown` calls. */
export async function stopBundleServer(): Promise<void> {
  const running = readState()
  // The file outlives its Metro when teardown never ran, and its pid may since be anything.
  if (running !== null && alive(running.pid) && (await status(running.port))) {
    // Its own process group, so the transform workers go with it.
    try {
      process.kill(-running.pid, 'SIGTERM')
    } catch {
      process.kill(running.pid, 'SIGTERM')
    }
  }
  rmSync(stateFile, { force: true })
}

/**
 * Makes sure Metro is serving a bundle built with exactly `env`, restarting it otherwise.
 *
 * Expo inlines every `EXPO_PUBLIC_` variable into the bundle when it transforms a file, so on a
 * device the fake, its fixture and the theme are chosen here rather than at launch, and a change
 * is a restart with `--clear`: Metro's cache would otherwise serve the previous transform.
 * Recorded in a file because Playwright replaces its worker after a failure, and the next one
 * must find the server rather than start a second on the same port.
 */
export async function serveBundle(
  env: Readonly<Record<string, string>>,
  platform: 'android' | 'ios',
): Promise<void> {
  const key = keyOf(env)
  const running = readState()
  if (running?.key === key && alive(running.pid) && (await status(running.port))) return
  await stopBundleServer()
  // A stopped Metro keeps answering until its process has exited.
  const stopping = Date.now() + STOP_TIMEOUT_MS
  while ((await status(METRO_PORT)) && Date.now() < stopping)
    await new Promise((resolve) => setTimeout(resolve, 500))
  if (await status(METRO_PORT))
    throw new Error(
      `something else is serving on ${String(METRO_PORT)}: set SESSION_E2E_METRO_PORT`,
    )

  mkdirSync(join(repoRoot, 'test-results'), { recursive: true })
  const log = openSync(logFile, 'a')
  const child = spawn(
    process.execPath,
    [
      join(repoRoot, 'node_modules/expo/bin/cli'),
      'start',
      '--dev-client',
      '--clear',
      '--port',
      String(METRO_PORT),
    ],
    {
      cwd: join(repoRoot, 'apps/mobile'),
      env: { ...process.env, CI: '1', ...env },
      detached: true,
      stdio: ['ignore', log, log],
    },
  )
  child.unref()
  if (child.pid === undefined) throw new Error('Metro did not start')
  writeFileSync(stateFile, JSON.stringify({ pid: child.pid, port: METRO_PORT, key }))

  const deadline = Date.now() + START_TIMEOUT_MS
  while (!(await status(METRO_PORT))) {
    if (!alive(child.pid)) throw new Error(`Metro exited while starting; see ${logFile}`)
    if (Date.now() > deadline) throw new Error(`Metro did not answer in time; see ${logFile}`)
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  const bundle = `http://127.0.0.1:${String(METRO_PORT)}/apps/mobile/index.bundle?platform=${platform}&dev=true&minify=false`
  const response = await fetch(bundle, { signal: AbortSignal.timeout(WARM_TIMEOUT_MS) })
  if (!response.ok)
    throw new Error(`Metro could not bundle the app (${String(response.status)}); see ${logFile}`)
  await response.arrayBuffer()
}
