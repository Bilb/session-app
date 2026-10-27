import { describe, expect, it } from 'vitest'

import { fileRow, type FileRowSituation } from '#src/fileRow'

const FILE: FileRowSituation = {
  filename: 'report.pdf',
  format: 'PDF',
  caption: '2 MB',
  state: 'idle',
}

describe('a file row on native', () => {
  it('is named by the file, its format and its caption, skipping what is empty', () => {
    expect(fileRow(FILE).row.native?.name).toBe('report.pdf, PDF, 2 MB')
    expect(fileRow({ ...FILE, format: '' }).row.native?.name).toBe('report.pdf, 2 MB')
  })

  it('activates with its own press where it has one', () => {
    const row = fileRow({ ...FILE, rowVerb: 'Download', controlName: 'Download' }).row.native
    expect(row).toMatchObject({ role: 'button', hint: 'Download', disabled: false })
  })

  it('activates with its control’s verb where it has no press of its own', () => {
    const row = fileRow({ ...FILE, state: 'failed', controlName: 'Retry' }).row.native
    expect(row).toMatchObject({ role: 'button', hint: 'Retry' })
  })

  it('is a disabled, busy button while a transfer runs and nothing else can act', () => {
    const row = fileRow({ ...FILE, state: 'fetching', controlName: 'Downloading' }).row.native
    expect(row).toMatchObject({ role: 'button', hint: null, disabled: true, busy: true })
  })

  it('is no button with nothing to do', () => {
    expect(fileRow({ ...FILE, state: 'unavailable' }).row.native?.role).toBe('none')
  })

  it('offers each verb once as an action, its activation first', () => {
    const verbs = (situation: Partial<FileRowSituation>) => fileRow({ ...FILE, ...situation }).verbs
    const opens = { leadOpens: true, leadVerb: 'Open' }
    expect(verbs({ state: 'ready', rowVerb: 'Open', ...opens, controlName: 'Export' })).toEqual([
      'Open',
      'Export',
    ])
    expect(
      verbs({
        rowVerb: 'Download',
        leadOpens: true,
        leadVerb: 'Download',
        controlName: 'Download',
      }),
    ).toEqual(['Download'])
    expect(verbs({ state: 'fetching', leadOpens: true, controlName: 'Downloading' })).toEqual([])
  })
})

describe('a file row on the desktop', () => {
  it('is no button itself, leaving that to the lead square and the control', () => {
    const parts = fileRow({ ...FILE, rowVerb: 'Open', leadOpens: true, leadVerb: 'Open' })
    expect(parts.row.desktop?.role).toBe('none')
    expect(parts.lead.desktop).toMatchObject({ role: 'button', hint: 'Open' })
  })
})
