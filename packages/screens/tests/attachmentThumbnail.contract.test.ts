import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A tile draws libsession's thumbnail and the viewer draws the file, read from the source because
 * nothing in the unit tier renders a tile. A tile handed the file would decode a full photograph
 * for a few hundred pixels, so it does only for a type libsession never thumbnails: see `leadUri`.
 */
describe('which picture each place draws', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

  it('draws the lead through leadUri in the album and the list, never the file directly', () => {
    for (const file of ['MessageAlbum.tsx', 'AttachmentRow.tsx']) {
      const source = read(file)
      expect(source, file).toMatch(/uri: leadUri\(message\.id, attachment, state\)/)
      expect(source, file).not.toContain('media.urlFor(')
      expect(source, file).not.toContain('media.thumbnailUrlFor(')
    }
  })

  it('prefers the thumbnail, and falls back to the file only for a type that never gets one', () => {
    expect(read('viewableAttachments.ts')).toMatch(
      /if \(attachment\.hasThumbnail\) return requirePorts\(\)\.media\.thumbnailUrlFor\(ref\)\n\s*if \(state === 'ready' && isViewable\(attachment\) && !isDisplayableImage\(attachment\.contentType\)\)\n\s*return requirePorts\(\)\.media\.urlFor\(ref\)/,
    )
  })

  it('draws the file in the viewer', () => {
    expect(read('viewableAttachments.ts')).toContain('requirePorts().media.urlFor(')
  })
})
