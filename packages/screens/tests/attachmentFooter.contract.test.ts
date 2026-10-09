import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The footer's row is what bounds its buttons' touch targets.
 *
 * A `hitSlop` never reaches past the parent's bounds on iOS or Android, so a 48 target inside a
 * 32 row is a 32 target. Read from the source because nothing short of a device hit-tests it.
 */
describe('the attachment footer', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/AttachmentFooter.tsx'), 'utf8')
  const row = source.slice(
    source.indexOf('<XStack'),
    source.indexOf('>\n', source.indexOf('<XStack')),
  )

  it('grows its row to a button’s target on touch, and gives the growth back as margin', () => {
    expect(source).toMatch(/ROW_HEIGHT = Math.max\(FOOTER_HEIGHT, ROW_TOUCH_TARGET\)/)
    expect(row).toContain('height={ROW_HEIGHT}')
    expect(row).toContain('marginVertical={-ROW_OVERHANG}')
  })

  it('draws the verb as a tonal button the line is sized to, with a slop that reaches the row', () => {
    const verb = source.slice(source.lastIndexOf('<Button'), source.indexOf('</Button>'))
    expect(verb).toContain('variant="tonal"')
    expect(verb).toContain('onPress={onAction}')
    expect(source).toMatch(/FOOTER_HEIGHT = buttonHeight\(ACTION_SIZE\)/)
    expect(source).toMatch(/ACTION_SLOP = ROW_OVERHANG/)
    expect(verb).toContain('hitSlop={ACTION_SLOP}')
  })

  it('lets a touch on the overhang through to what is drawn under it', () => {
    expect(row).toContain('pointerEvents="box-none"')
  })

  // RN takes a touch in a parent's overflow, and the footer is the later sibling, so a tile, a row
  // or "Show all" left under the overhang would hand its tap to the footer's Download.
  it('has nothing drawn under its overhang in a message', () => {
    const message = readFileSync(join(import.meta.dirname, '../src/MessageAttachments.tsx'), 'utf8')
    expect(message).toMatch(/<YStack gap=\{SPACE_SCALE\['3xs'\] \+ ROW_OVERHANG\}/)
  })

  it('has nothing drawn under its overhang in the sheet', () => {
    const sheet = readFileSync(join(import.meta.dirname, '../src/AttachmentSheet.tsx'), 'utf8')
    expect(sheet).toMatch(/<YStack paddingTop=\{ROW_OVERHANG\}>\s*<AttachmentFooter /)
  })
})
