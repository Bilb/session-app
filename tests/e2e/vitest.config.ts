import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // specs/ holds Playwright's specs, which launch an app and are not vitest's to run.
    include: ['tests/**/*.test.ts'],
  },
})
