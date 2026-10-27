import { renderProject, UNIT_PROJECT } from '@session/render-tier/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { projects: [UNIT_PROJECT, renderProject(import.meta.url)] },
})
