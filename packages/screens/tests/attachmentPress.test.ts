import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { FileRowState } from '@session/ui'
import { describe, expect, it } from 'vitest'

import { controlVerb, rowVerb } from '#src/attachmentPress'

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

/** The wiring, read from the source because nothing in the unit tier renders a row. */
describe('an attachment row', () => {
  const row = readFileSync(join(import.meta.dirname, '../src/AttachmentRow.tsx'), 'utf8')

  it('hands the row the row’s verb and the control the control’s, each with its label', () => {
    expect(row).toContain('const press = rowVerb(state, opens)')
    expect(row).toContain('const control = controlVerb(state)')
    expect(row).toContain('onPress={press === null ? undefined : perform[press]}')
    expect(row).toContain('pressLabel={press === null ? undefined : verbLabel(press)}')
    expect(row).toContain('onAction={control === null ? undefined : perform[control]}')
    expect(row).toContain('actionLabel={control === null ? undefined : verbLabel(control)}')
  })

  it('opens the viewer with the catalogue’s Open, and exports from the control', () => {
    expect(row).toMatch(/case 'open':\s*return tr\('open'\)/)
    expect(row).toMatch(/open: \(\) => \{\s*ui\.openViewer\(message\.id, attachment\.index\)/)
    expect(row).toMatch(/control === 'export'\s*\?\s*ELEMENT\.conversation\.attachmentExport/)
  })

  it('makes the lead square do what the row does', () => {
    expect(row).toContain('if (press !== null) perform[press]()')
  })
})
