import { defineConfig } from 'vitest/config'

// `#src/*` resolves to its first target whether or not that file exists, so a `.tsx` module is
// unreachable through it at runtime; this alias lets Vite try both extensions.
export default defineConfig({
  resolve: { alias: [{ find: /^#src\/(.*)$/, replacement: '/src/$1' }] },
  test: { include: ['tests/**/*.test.ts'] },
})
