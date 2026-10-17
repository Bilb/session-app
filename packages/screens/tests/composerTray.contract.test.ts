import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PENDING_COPY } from '#src/pendingCopy'

describe('the composer’s staged tray', () => {
  const composer = readFileSync(join(import.meta.dirname, '../src/Composer.tsx'), 'utf8')

  it('says its count in words', () => {
    expect(PENDING_COPY.attachmentsStagedCountSpoken(3, 32)).toBe('3 of 32 attachments')
    expect(composer).toContain('countSpokenLabel={PENDING_COPY.attachmentsStagedCountSpoken(')
  })

  it('names its add tile apart from the composer’s +, though both open the same picker', () => {
    expect(composer).toContain('addLabel={PENDING_COPY.attachmentsAddMore}')
    expect(composer).toContain("accessibilityLabel={tr('attachmentsAdd')}")
  })
})
