import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A tile draws libsession's thumbnail and the viewer draws the file, read from the source because
 * nothing in the unit tier renders a tile. A tile handed the file would decode a full photograph
 * for a few hundred pixels, so it does only where libsession made no thumbnail: see `leadUri`.
 */
describe('which picture each place draws', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

  it('draws the lead through leadUri in the album and the list, never the file directly', () => {
    for (const file of ['MessageAlbum.tsx', 'AttachmentRow.tsx', 'SendingRow.tsx']) {
      const source = read(file)
      expect(source, file).toMatch(/uri: leadUri\(message\.id, attachment, /)
      expect(source, file).not.toContain('media.urlFor(')
      expect(source, file).not.toContain('media.thumbnailUrlFor(')
    }
  })

  it('draws the rendition in the viewer once there is one, else the file', () => {
    expect(read('viewableAttachments.ts')).toContain(
      'if (!attachment.hasRendition) return { uri: media.urlFor(ref) }',
    )
    expect(read('viewableAttachments.ts')).toContain('uri: media.renditionUrlFor(ref),')
    expect(read('MessageMediaViewer.tsx')).toMatch(
      /heldItem\(held\.current, [^,]+, \(\) =>\s+viewerItem\(target\.messageId, attachment\),/,
    )
    expect(read('MessageMediaViewer.tsx')).toContain('if (!open) held.current.clear()')
  })

  it('opens in the viewer only what is not an original file, in a row and in a tile', () => {
    expect(read('AttachmentRow.tsx')).toContain('const fit = viewerFit(attachment)')
    expect(read('MessageAlbum.tsx')).toContain('rowVerb(state, viewerFit(attachment))')
    expect(read('MessageAttachments.tsx')).toMatch(
      /if \(fit === 'opens'\) ui\.openViewer\(message\.id, index\)\s*else if \(fit === 'exports' && !sending\)\s+void exportOne\(/,
    )
  })

  it('prefers the thumbnail and falls back to the file only once it is here', () => {
    expect(read('viewableAttachments.ts')).toMatch(
      /if \(attachment\.hasThumbnail\) return requirePorts\(\)\.media\.thumbnailUrlFor\(ref\)\n\s*if \(state === 'ready' && isViewable\(attachment\)\) return requirePorts\(\)\.media\.urlFor\(ref\)/,
    )
  })
})
