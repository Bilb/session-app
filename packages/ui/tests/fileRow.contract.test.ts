import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * What `FileRow` draws that a list and a mirrored layout depend on, held by reading the source:
 * `packages/ui` renders nothing in its unit tier, and neither shows in a browser in English.
 */
describe('a file row', () => {
  const row = readFileSync(join(import.meta.dirname, '../src/FileRow.tsx'), 'utf8')

  it('holds the lead at the height fileRowHeight counts, with the padding it counts', () => {
    // `getItemLayout` places rows by that constant, so a row that measured differently would
    // scroll to the wrong place.
    expect(row).toMatch(
      /<YStack\s+width=\{FILE_LEAD_WIDTH\}\s+height=\{fileLeadHeight\(fontScale\)\}/,
    )
    expect(row).toMatch(
      /<XStack\s+alignItems="center"\s+gap=\{FILE_ROW_GAP\}\s+paddingVertical="\$xs"/,
    )
  })

  it('pins the name row to left-to-right, so a Latin name keeps head then tail under RTL', () => {
    // The row mirrors with the layout; the name is two runs, and mirrored they read ".pdf" first.
    expect(row).toContain("NAME_DIRECTION = { direction: 'ltr' }")
    expect(row).toMatch(/<XStack[^>]*style=\{NAME_DIRECTION\}[^>]*testID=\{testIDs\?\.name\}/)
  })
})
