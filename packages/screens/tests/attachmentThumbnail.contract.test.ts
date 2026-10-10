import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A tile draws libsession's thumbnail and the viewer draws the file, read from the source because
 * nothing in the unit tier renders a tile. A tile handed the file would decode a full photograph
 * for a few hundred pixels.
 */
describe('which picture each place draws', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

  it('draws the thumbnail in the album and the list, and only once there is one', () => {
    for (const file of ['MessageAlbum.tsx', 'AttachmentRow.tsx']) {
      const source = read(file)
      expect(source, file).toMatch(
        /attachment\.hasThumbnail\s*\?\s*requirePorts\(\)\.media\.thumbnailUrlFor\(/,
      )
      expect(source, file).not.toContain('media.urlFor(')
    }
  })

  it('draws the file in the viewer', () => {
    expect(read('viewableAttachments.ts')).toContain('requirePorts().media.urlFor(')
  })
})
