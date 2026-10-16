import { describe, expect, it } from 'vitest'

import { fileRowAccessibleName, fileRowActions } from '#src/fileRowAccessibility'

const noop = (): void => undefined

describe('what a file row is announced as on native', () => {
  it('says the name, the format and the caption', () => {
    expect(fileRowAccessibleName('report.pdf', 'PDF', '2 MB')).toBe('report.pdf, PDF, 2 MB')
  })

  it('leaves out a part that is empty', () => {
    expect(fileRowAccessibleName('notes', '', '')).toBe('notes')
  })
})

describe('the actions a file row offers on native', () => {
  it('opens a downloaded picture and offers its export', () => {
    const actions = fileRowActions({
      onPress: noop,
      pressLabel: 'Open',
      onOpen: noop,
      openLabel: 'Open',
      onAction: noop,
      actionLabel: 'Export',
    })
    expect(actions.map(({ name, label }) => [name, label])).toEqual([
      ['activate', 'Open'],
      ['control', 'Export'],
    ])
  })

  it('offers a download once, though the row and its control both say it', () => {
    const actions = fileRowActions({
      onPress: noop,
      pressLabel: 'Download',
      onAction: noop,
      actionLabel: 'Download',
    })
    expect(actions.map(({ name }) => name)).toEqual(['activate'])
  })

  it('offers a retry for a failed file', () => {
    const actions = fileRowActions({ onAction: noop, actionLabel: 'Retry' })
    expect(actions.map(({ name, label }) => [name, label])).toEqual([['control', 'Retry']])
  })

  it('runs the part the action names', () => {
    const ran: string[] = []
    const actions = fileRowActions({
      onPress: () => ran.push('row'),
      pressLabel: 'Open',
      onOpen: () => ran.push('lead'),
      openLabel: 'View',
      onAction: () => ran.push('control'),
      actionLabel: 'Export',
    })
    for (const action of actions) action.run()
    expect(ran).toEqual(['row', 'lead', 'control'])
  })

  it('offers nothing for a verb with no press or no words', () => {
    expect(fileRowActions({ onAction: noop })).toEqual([])
    expect(fileRowActions({ actionLabel: 'Export' })).toEqual([])
  })
})
