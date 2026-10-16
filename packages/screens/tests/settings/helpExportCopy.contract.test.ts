import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Help's Report a Bug row describes what its button does, which differs by platform: desktop
 * saves a file, a phone hands it to the share sheet. Read rather than rendered, as the other
 * screen contracts are.
 */
const source = readFileSync(join(import.meta.dirname, '../../src/settings/HelpPage.tsx'), 'utf8')

describe("Help's Report a Bug row", () => {
  it('says save on desktop and export on a phone, by how the platform delivers', () => {
    expect(source).toMatch(
      /logs\.deliversBy === 'saveDialog'\s*\?\s*'helpReportABugExportLogsSaveToDesktopDescription'\s*:\s*'helpReportABugExportLogsDescription'/,
    )
  })
})
