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

  it('draws the rendition in the viewer once there is one, else the file', () => {
    expect(read('viewableAttachments.ts')).toContain(
      'if (!attachment.hasRendition) return { uri: media.urlFor(ref) }',
    )
    expect(read('viewableAttachments.ts')).toContain('uri: media.renditionUrlFor(ref),')
    expect(read('MessageMediaViewer.tsx')).toContain(
      'viewable.map((attachment) => viewerItem(target.messageId, attachment))',
    )
  })

  it('opens in the viewer only what is not an original file, in a row and in a tile', () => {
    expect(read('AttachmentRow.tsx')).toContain('const fit = viewerFit(attachment)')
    expect(read('MessageAlbum.tsx')).toContain('rowVerb(state, viewerFit(attachment))')
    expect(read('MessageAttachments.tsx')).toMatch(
      /if \(fit === 'opens'\) ui\.openViewer\(message\.id, index\)\s*else if \(fit === 'exports' && !sending\)\s+void exportOne\(/,
    )
  })
})
