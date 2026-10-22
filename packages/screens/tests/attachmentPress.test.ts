import { verbName } from '@session/expectations'
import type { FileRowState } from '@session/ui'
import { describe, expect, it } from 'vitest'

import { controlVerb, rowVerb, verbLabel, type AttachmentVerb } from '#src/attachmentPress'

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

// A record, so a verb added to the screen and not here fails to typecheck, and one the
// expectations do not know fails at `verbName`.
const VERBS = Object.keys({
  download: true,
  retry: true,
  export: true,
  open: true,
} satisfies Record<AttachmentVerb, true>) as AttachmentVerb[]

describe('what a screen reader says a press does', () => {
  it.each(VERBS)('names %s as the expectations do', (verb) => {
    expect(verbLabel(verb)).toBe(verbName(verb))
  })
})
