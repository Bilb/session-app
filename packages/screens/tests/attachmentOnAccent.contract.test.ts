import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

/**
 * A bubble you sent is `$primaryColor`, so the text and glyphs a message's attachments draw on it
 * take `$onAccent`; the same rows in the sheet sit on the page and keep the page roles.
 */
describe('attachments on a bubble you sent', () => {
  it('are told the bubble is the accent by the message they belong to', () => {
    const message = read('MessageAttachments.tsx')
    expect(message).toMatch(
      /<AttachmentList\s+message=\{message\}\s+onAccent=\{message\.outgoing\}/,
    )
    expect(message).toMatch(/<AttachmentFooter\s+set=\{set\}\s+onAccent=\{message\.outgoing\}/)
    expect(message).toMatch(/<MessageAlbum\s+message=\{message\}\s+onAccent=\{message\.outgoing\}/)
  })

  it('hand it to the album, whose focus ring falls on the fill', () => {
    expect(read('MessageAlbum.tsx')).toMatch(/<AttachmentAlbum[\s\S]*onAccent=\{onAccent\}/)
  })

  it('hand it to every row and to "Show all"', () => {
    const list = read('AttachmentList.tsx')
    expect(list).toMatch(/<AttachmentRow[^>]*onAccent=\{onAccent\}/)
    expect(list).toMatch(/<ShowAll[^>]*onAccent=\{onAccent\}/)
    expect(list).toContain("{...inkFor('link', onAccent)}")
    expect(list.match(/\{\.\.\.inkFor\('secondary', onAccent\)\}/g)).toHaveLength(2)
    expect(list).not.toMatch(/\$accentText|\$textSecondary|tone="secondary"/)
    expect(read('AttachmentRow.tsx')).toMatch(/<FileRow[\s\S]*onAccent=\{onAccent\}/)
  })

  it('draw the footer’s caption in the fill’s ink, and leave its buttons on their own fill', () => {
    const footer = read('AttachmentFooter.tsx')
    expect(footer).toContain("{...inkFor('secondary', onAccent)}")
    expect(footer).not.toContain('color="$textSecondary"')
    // A Button reads `onAccent` for its focus ring alone, which falls on the bubble round it.
    // Up to the line that closes the Button's own tag, past any element inside a prop.
    for (const button of footer.split('<Button').slice(1))
      expect(button.slice(0, button.search(/\n\s*\/?>\n/))).toContain('onAccent={onAccent}')
  })

  it('are not on the accent in the sheet, which draws them on the page', () => {
    const sheet = read('AttachmentSheet.tsx')
    expect(sheet).not.toContain('onAccent')
  })
})
