import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  attachmentFooterAction,
  type AttachmentSetState,
  FOOTER_ACTION_ID,
} from '@session/expectations'
import { byId, nodeOf } from '@session/render-tier'

import { AttachmentFooter } from '#src/AttachmentFooter'
import type { AttachmentSet } from '#src/attachmentSet'

import { renderScreen } from './support/render'

function set(state: AttachmentSetState, count: number): AttachmentSet {
  return { state, count, doneBytes: 0, totalBytes: 0, failed: 0, unreadable: 0 }
}

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
