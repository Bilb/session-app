import { defineConfig } from '@playwright/test'

/**
 * Projects are platforms. The desktop one needs nothing but a built app; the mobile ones
 * arrive with the Nitro bridge and a device pool.
 *
 * Neither e2e workflow runs on a pull request — they are started by hand — so the timeouts
 * here are generous rather than tuned for a queue.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../test-results/report' }]],
  outputDir: '../../test-results/artifacts',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop', testMatch: /.*\.spec\.ts/ }],
})
