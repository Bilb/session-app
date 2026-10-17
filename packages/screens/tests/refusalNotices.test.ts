import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { MAX_ATTACHMENT_BYTES } from '@session/basic-types'
import { PENDING_COPY, tr } from '@session/localization'
import { describe, expect, it } from 'vitest'

import { refusalAnnouncement, refusalNotices } from '#src/refusalNotices'

const big = { path: '/picked/drone.mov', name: 'drone.mov', size: MAX_ATTACHMENT_BYTES + 1 }

describe('what the composer says about a refusal', () => {
  it('stacks a notice for each thing a pick left out', () => {
    const notices = refusalNotices({ tooLarge: [big], overLimit: 3, unreadable: 1 })
    expect(notices.map((n) => n.kind)).toEqual(['unreadable', 'tooLarge', 'overLimit'])
  })

  it('says every notice of one pick in one announcement, so none cuts another off', () => {
    const notices = refusalNotices({ tooLarge: [big], overLimit: 3, unreadable: 0 })
    const said = refusalAnnouncement(notices)
    const lines = said.split('\n')
    expect(lines[0]).toBe(`${tr('attachmentsErrorSize')}.`)
    expect(lines[1]?.startsWith('drone.mov · ')).toBe(true)
    expect(lines[1]?.endsWith('.')).toBe(true)
    // A stop where the copy has none, and never a second one after its own.
    expect(lines.slice(2)).toEqual([
      PENDING_COPY.attachmentsErrorLimit(32),
      `${PENDING_COPY.attachmentsNotAdded(3)}.`,
    ])
    expect(said).not.toContain('..')
  })

  it('says nothing when nothing was refused', () => {
    expect(refusalAnnouncement(refusalNotices({ tooLarge: [], overLimit: 0, unreadable: 0 }))).toBe(
      '',
    )
  })

  it('is said by the composer once, for every notice it stacks', () => {
    const composer = readFileSync(join(import.meta.dirname, '../src/Composer.tsx'), 'utf8')
    expect(composer.match(/<Announcement\b/g)).toHaveLength(1)
    expect(composer).toContain('announceKey={staging.refusal}')
    expect(composer.match(/announceKey=/g)).toHaveLength(1)
  })
})
