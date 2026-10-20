import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  attachmentFooterAction,
  type AttachmentSetState,
  FOOTER_ACTION_ID,
} from '@session/expectations'
import { byId, declared, nodeOf } from '@session/render-tier'
import { ELEMENT } from '@session/test-ids'
import { buttonHeight } from '@session/ui'

import { AttachmentFooter } from '#src/AttachmentFooter'
import type { AttachmentSet } from '#src/attachmentSet'
import { PENDING_COPY } from '#src/pendingCopy'

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
    const expected = attachmentFooterAction({ state, count, exportName: PENDING_COPY.export })
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

describe('an attachment footer’s line', () => {
  it('draws its verb as a quiet tonal button, and is as tall as a small button', () => {
    renderScreen(<AttachmentFooter set={set('idle', 2)} onAction={() => {}} />)
    const frame = byId(FOOTER_ACTION_ID).firstElementChild!
    expect(declared(frame)['background-color']).toBe('var(--backgroundNested)')
    expect(declared(byId(ELEMENT.conversation.attachmentFooter)).height).toBe(
      `${String(buttonHeight('sm'))}px`,
    )
  })
})
