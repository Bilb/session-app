import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A message's attachments are drawn at one width, whichever shape they take.
 *
 * A bubble is as wide as what is in it. On native, a list left to size itself inside one gives its
 * flexible columns - the name, and the footer's total - no width at all, and both draw as an
 * ellipsis; a browser happens to lay the same tree out wider, so the desktop e2e run cannot see
 * it. Read from the source for that reason.
 */
describe('the attachments of a message', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/MessageAttachments.tsx'), 'utf8')

  it('take the album’s width in the list as well as the gallery', () => {
    const root = source.slice(source.indexOf('return (\n'))
    expect(root).toMatch(/^return \(\n(\s*\/\/.*\n)*\s*<YStack[^>]*width=\{ALBUM_WIDTH\}/)
  })
})
