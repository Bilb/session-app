import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * Which transport the desktop app selected, read from libsession's own log.
 *
 * Skipped unless asked for: it onboards against the real bridge and attaches testnet, so it opens
 * sockets and is not something the fast tier should do on every run. The addon-level twin is
 * `packages/bridge-node/tests/router.test.ts`; this one covers the half that only the app has -
 * that EXPO_PUBLIC_SESSION_ROUTER reaches the transport options at all.
 *
 *     SESSION_ROUTER_PROBE=1 pnpm exec playwright test --project desktop --grep @router
 */
const enabled = process.env['SESSION_ROUTER_PROBE'] === '1'

/** libsession logs the choice as the network is configured. */
const ROUTE = /route requests using ([^\\"]+)/

async function transportFor(router: string): Promise<string> {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-router-desktop-'))
  const app = await _electron.launch({
    args: [
      join(repoRoot, 'apps/desktop/out/main/index.js'),
      `--user-data-dir=${dataDir}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '',
      EXPO_PUBLIC_SESSION_NETID: 'testnet',
      EXPO_PUBLIC_SESSION_ROUTER: router,
      EXPO_PUBLIC_SESSION_LOG: 'debug',
    },
  })
  const page = await app.firstWindow()
  const seen: string[] = []
  page.on('console', (m) => seen.push(m.text()))
  await page.waitForLoadState('domcontentloaded')

  // Attaching is what logs the choice, and only an account makes the bridge attach.
  await page.getByTestId('onboarding-create-account').click({ timeout: 20_000 })

  try {
    for (let i = 0; i < 60; i++) {
      const hit = seen.map((line) => ROUTE.exec(line)?.[1]).find(Boolean)
      if (hit !== undefined) return hit.trim()
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return '(no routing choice logged)'
  } finally {
    await app.close()
  }
}

test('the desktop app routes the way it was told @desktop @router', async () => {
  test.skip(!enabled, 'needs SESSION_ROUTER_PROBE=1: it attaches a real network')
  test.setTimeout(300_000)
  expect(await transportFor('onion-requests')).toBe('Onion Requests')
  expect(await transportFor('session-router')).toBe('Session Router')
})
