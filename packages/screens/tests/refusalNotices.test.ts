import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { MAX_ATTACHMENT_BYTES } from '@session/basic-types'
import { PENDING_COPY, tr } from '@session/localization'
import { describe, expect, it } from 'vitest'

import { refusalAnnouncement, refusalNotices } from '#src/refusalNotices'

const big = { path: '/picked/drone.mov', name: 'drone.mov', size: MAX_ATTACHMENT_BYTES + 1 }
const PANO_BYTES = 12
const NAMED = { tooLarge: [], tooLargeToDecode: [], unopenable: [] }

describe('what the composer says about a refusal', () => {
  it('stacks a notice for each thing a pick left out', () => {
    const notices = refusalNotices({
      ...NAMED,
      tooLarge: [big],
      overLimit: 3,
      unreadable: 1,
      sendRefused: 'none',
    })
    expect(notices.map((n) => n.kind)).toEqual(['unreadable', 'tooLarge', 'overLimit'])
  })

  it('names what a plan refused, in the order the notices stack', () => {
    const pano = { path: '/picked/pano.jpg', name: 'pano.jpg', size: PANO_BYTES }
    const gone = { path: '/picked/gone.pdf', name: 'gone.pdf' }
    const notices = refusalNotices({
      tooLarge: [big],
      tooLargeToDecode: [pano],
      unopenable: [gone, pano],
      overLimit: 0,
      unreadable: 0,
      sendRefused: 'none',
    })
    expect(notices.map((n) => [n.id, n.message])).toEqual([
      ['open', tr('attachmentsErrorOpen')],
      ['size', tr('attachmentsErrorSize')],
      ['pixels', PENDING_COPY.attachmentsErrorImageTooLarge],
    ])
    expect(notices[0]?.detail).toBe(PENDING_COPY.attachmentNameAndMore('gone.pdf', 1))
    expect(notices[2]?.detail?.startsWith('pano.jpg · ')).toBe(true)
  })

  it('says a refused send failed, above anything else', () => {
    const notices = refusalNotices({
      ...NAMED,
      tooLarge: [],
      overLimit: 0,
      unreadable: 1,
      sendRefused: 'files',
    })
    expect(notices.map((n) => [n.id, n.message])).toEqual([
      ['send', tr('attachmentsErrorSending')],
      ['unreadable', tr('attachmentsErrorLoad')],
    ])
  })

  it('says a refused message with no files failed, not that a file did', () => {
    const notices = refusalNotices({
      ...NAMED,
      tooLarge: [],
      overLimit: 0,
      unreadable: 0,
      sendRefused: 'text',
    })
    expect(notices.map((n) => [n.id, n.message])).toEqual([
      ['send', tr('messageStatusFailedToSend')],
    ])
  })

  it('says every notice of one pick in one announcement, so none cuts another off', () => {
    const notices = refusalNotices({
      ...NAMED,
      tooLarge: [big],
      overLimit: 3,
      unreadable: 0,
      sendRefused: 'none',
    })
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
    expect(
      refusalAnnouncement(
        refusalNotices({ ...NAMED, overLimit: 0, unreadable: 0, sendRefused: 'none' }),
      ),
    ).toBe('')
  })

  it('is said by the composer once, for every notice it stacks', () => {
    const composer = readFileSync(join(import.meta.dirname, '../src/Composer.tsx'), 'utf8')
    expect(composer.match(/<Announcement\b/g)).toHaveLength(1)
    expect(composer).toContain('announceKey={staging.refusal}')
    expect(composer.match(/announceKey=/g)).toHaveLength(1)
  })
})
