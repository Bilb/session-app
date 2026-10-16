import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { tr } from '@session/localization'
import type { FileRowState } from '@session/ui'
import { describe, expect, it } from 'vitest'

import { controlVerb, rowVerb, verbLabel } from '#src/attachmentPress'
import { PENDING_COPY } from '#src/pendingCopy'
import type { ViewerFit } from '#src/viewableAttachments'

const STATES: FileRowState[] = ['idle', 'fetching', 'ready', 'failed', 'unavailable']
const FITS: ViewerFit[] = ['opens', 'awaitsRendition', 'exports']

describe('what a press on an attachment row does', () => {
  it('opens a picture the viewer shows once it is here', () => {
    expect(rowVerb('ready', 'opens')).toBe('open')
  })

  it('exports anything else that is here', () => {
    expect(rowVerb('ready', 'exports')).toBe('export')
  })

  it('does nothing for a picture that is here until libsession has a rendition of it', () => {
    expect(rowVerb('ready', 'awaitsRendition')).toBeNull()
  })

  it('fetches what is not here yet, picture or not', () => {
    for (const fit of FITS) {
      expect(rowVerb('idle', fit)).toBe('download')
      expect(rowVerb('failed', fit)).toBe('retry')
    }
  })

  it('does nothing while fetching or once the file is gone', () => {
    for (const fit of FITS) {
      expect(rowVerb('fetching', fit)).toBeNull()
      expect(rowVerb('unavailable', fit)).toBeNull()
    }
  })

  it('leaves the control exporting a picture the row opens', () => {
    expect(controlVerb('ready')).toBe('export')
  })

  it('is the control’s verb in every state but a picture that is here', () => {
    for (const state of STATES) {
      expect(rowVerb(state, 'exports')).toBe(controlVerb(state))
      if (state !== 'ready')
        for (const fit of FITS) expect(rowVerb(state, fit)).toBe(controlVerb(state))
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

/** The wiring, read from the source because nothing in the unit tier renders a row. */
describe('an attachment row', () => {
  const row = readFileSync(join(import.meta.dirname, '../src/AttachmentRow.tsx'), 'utf8')

  it('hands the row the row’s verb and the control the control’s, each with its label', () => {
    expect(row).toContain('const press = rowVerb(state, fit)')
    expect(row).toContain('const control = controlVerb(state)')
    expect(row).toContain('onPress={press === null ? undefined : perform[press]}')
    expect(row).toContain('const pressLabel = press === null ? undefined : verbLabel(press)')
    expect(row).toContain('pressLabel={pressLabel}')
    expect(row).toContain('onAction={control === null ? undefined : perform[control]}')
    expect(row).toMatch(
      /actionLabel=\{\s*state === 'fetching' \? tr\('downloading'\) : control === null \? undefined : verbLabel\(control\)\s*\}/,
    )
  })

  it('opens the viewer, and exports from the control', () => {
    expect(row).toMatch(/open: \(\) => \{\s*ui\.openViewer\(message\.id, attachment\.index\)/)
    expect(row).toMatch(/control === 'export'\s*\?\s*ELEMENT\.conversation\.attachmentExport/)
  })

  it('makes the lead square do what the row does, and say what the row says', () => {
    expect(row).toContain('if (press !== null) perform[press]()')
    expect(row).toContain('openLabel={pressLabel}')
  })
})
