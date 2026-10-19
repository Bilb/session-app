import { tr } from '@session/localization'
import type { FileRowState } from '@session/ui'
import { describe, expect, it } from 'vitest'

import { controlVerb, rowVerb, verbLabel } from '#src/attachmentPress'
import { PENDING_COPY } from '#src/pendingCopy'

const STATES: FileRowState[] = ['idle', 'fetching', 'ready', 'failed', 'unavailable']

describe('what a press on an attachment row does', () => {
  it('opens a picture the viewer shows once it is here', () => {
    expect(rowVerb('ready', true)).toBe('open')
  })

  it('exports anything else that is here', () => {
    expect(rowVerb('ready', false)).toBe('export')
  })

  it('fetches what is not here yet, picture or not', () => {
    for (const viewable of [true, false]) {
      expect(rowVerb('idle', viewable)).toBe('download')
      expect(rowVerb('failed', viewable)).toBe('retry')
    }
  })

  it('does nothing while fetching or once the file is gone', () => {
    for (const viewable of [true, false]) {
      expect(rowVerb('fetching', viewable)).toBeNull()
      expect(rowVerb('unavailable', viewable)).toBeNull()
    }
  })

  it('leaves the control exporting a picture the row opens', () => {
    expect(controlVerb('ready')).toBe('export')
  })

  it('is the control’s verb in every state but a picture that is here', () => {
    for (const state of STATES) {
      expect(rowVerb(state, false)).toBe(controlVerb(state))
      if (state !== 'ready') expect(rowVerb(state, true)).toBe(controlVerb(state))
    }
  })
})

describe('what a screen reader says a press does', () => {
  it('takes each verb’s word from the catalogue, and Export from the pending copy', () => {
    expect(verbLabel('open')).toBe(tr('open'))
    expect(verbLabel('download')).toBe(tr('download'))
    expect(verbLabel('retry')).toBe(tr('retry'))
    expect(verbLabel('export')).toBe(PENDING_COPY.export)
  })
})
