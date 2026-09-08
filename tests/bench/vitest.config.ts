import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /**
     * These files measure rather than assert, so their runtime is the corpus size times the
     * machine, not a fixed cost. The conversation-list report walks up to 5000 conversations and
     * lands near vitest's 5s default on a developer's machine, which makes it pass locally and
     * time out on a CI runner. A measurement that fails for being slow is measuring the runner.
     */
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
