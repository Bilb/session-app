import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/** Read from the source: whether a memoised tile re-renders is not something a render shows. */
describe('an album', () => {
  const album = readFileSync(join(import.meta.dirname, '../src/MessageAlbum.tsx'), 'utf8')

  it('holds a tile still while a transfer reports, the open callback included', () => {
    // A new callback per report would re-render every memoised tile with it.
    expect(album).toContain('onOpen={openAt}')
    expect(album).toMatch(/const openAt = useCallback\([\s\S]*?\[viewable\],\s*\)/)
  })
})
