import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { memoryPorts, resetPorts, setPorts } from '@session/app'
import { formatBytes } from '@session/basic-types'
import {
  attachmentFooterAction,
  attachmentFooterProgress,
  type AttachmentSetState,
  FOOTER_ACTION_ID,
  FOOTER_PROGRESS_ID,
} from '@session/expectations'
import { isolate, PENDING_COPY } from '@session/localization'
import { byId, nodeOf } from '@session/render-tier'

import { AttachmentFooter } from '#src/AttachmentFooter'
import type { AttachmentSet } from '#src/attachmentSet'

import { renderScreen } from './support/render'

function set(
  state: AttachmentSetState,
  count: number,
  bytes: { doneBytes: number; totalBytes: number } = { doneBytes: 0, totalBytes: 0 },
): AttachmentSet {
  return { state, count, ...bytes, failed: 0, unreadable: 0 }
}

// A ring that does not know how far along it is asks the flags whether it may turn.
beforeEach(() => {
  setPorts(memoryPorts())
})

afterEach(() => {
  resetPorts()
})

const CASES: Array<[AttachmentSetState, number]> = [
  ['idle', 1],
  ['idle', 3],
  ['fetching', 1],
  ['ready', 1],
  ['ready', 3],
  ['failed', 2],
  ['unavailable', 1],
]

describe('an attachment footer’s verb', () => {
  it.each(CASES)('is what a set %s of %i offers', (state, count) => {
    renderScreen(<AttachmentFooter set={set(state, count)} onAction={() => {}} />)
    const expected = attachmentFooterAction({ state, count })
    if (expected.desktop === null) expect(nodeOf(FOOTER_ACTION_ID)).toBeNull()
    else expect(nodeOf(FOOTER_ACTION_ID)).toMatchObject(expected.desktop)
  })

  it('runs the footer’s action', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderScreen(<AttachmentFooter set={set('idle', 2)} onAction={onAction} />)
    await user.click(byId(FOOTER_ACTION_ID))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})

describe('a running download’s ring', () => {
  const RUNNING = { doneBytes: 12_000_000, totalBytes: 29_900_000 }

  it('is a progress bar reading the bytes so far of the total, in place of the verb', () => {
    renderScreen(<AttachmentFooter set={set('fetching', 3, RUNNING)} onAction={() => {}} />)
    expect(nodeOf(FOOTER_PROGRESS_ID)).toMatchObject(attachmentFooterProgress().desktop ?? {})
    const ring = byId(FOOTER_PROGRESS_ID)
    expect(ring.getAttribute('aria-valuenow')).toBe('40')
    expect(ring.getAttribute('aria-valuetext')).toBe(
      PENDING_COPY.attachmentsDownloadProgress(
        isolate(formatBytes(RUNNING.doneBytes)),
        isolate(formatBytes(RUNNING.totalBytes)),
      ),
    )
    expect(nodeOf(FOOTER_ACTION_ID)).toBeNull()
  })

  it.each([
    ['0 of 0, the first report of every transfer', { doneBytes: 0, totalBytes: 0 }],
    ['0 of a known total', { doneBytes: 0, totalBytes: RUNNING.totalBytes }],
    ['bytes of a total some sender never declared', { doneBytes: 5_000, totalBytes: 0 }],
  ])('reads nothing at %s', (_case, bytes) => {
    renderScreen(<AttachmentFooter set={set('fetching', 3, bytes)} onAction={() => {}} />)
    expect(nodeOf(FOOTER_PROGRESS_ID)).toMatchObject(attachmentFooterProgress().desktop ?? {})
    const ring = byId(FOOTER_PROGRESS_ID)
    expect(ring.getAttribute('aria-valuenow')).toBeNull()
    expect(ring.getAttribute('aria-valuetext')).toBeNull()
  })

  it('takes no press, since nothing can stop a transfer yet', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderScreen(<AttachmentFooter set={set('fetching', 1, RUNNING)} onAction={onAction} />)
    await user.click(byId(FOOTER_PROGRESS_ID))
    expect(onAction).not.toHaveBeenCalled()
  })

  it('is not drawn for our own message’s upload, whose line is about the upload', () => {
    renderScreen(
      <AttachmentFooter
        set={set('fetching', 2, RUNNING)}
        onAction={() => {}}
        sending={{ caption: '1 of 2 uploaded', retryable: false }}
      />,
    )
    expect(nodeOf(FOOTER_PROGRESS_ID)).toBeNull()
  })
})
