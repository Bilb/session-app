import { defineConfig } from '@playwright/test'

/**
 * Projects are platforms, chosen by the tag `sessionTest` gives a test; one with neither mobile tag
 * is the desktop's. The desktop needs nothing but a built app; Android and iOS need Appium, the
 * dev client and the devices `MobileApp` names.
 *
 * Neither e2e workflow runs on a pull request - they are started by hand - so the timeouts
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
  // Stops the Metro a mobile run started.
  globalTeardown: './harness/teardown.ts',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testMatch: /.*\.spec\.ts/, grepInvert: /@(android|ios)\b/ },
    // A device runs a bundle at a time, and the first launch on a new one waits for its transform.
    { name: 'android', testMatch: /.*\.spec\.ts/, grep: /@android\b/, timeout: 600_000 },
    // XCTest's audit and page source take seconds each, and a themed cell reads both per screen.
    { name: 'ios', testMatch: /.*\.spec\.ts/, grep: /@ios\b/, timeout: 1_800_000 },
  ],
})
