import { describe, expect, it } from 'vitest'

import {
  fileRowAccessibleName,
  fileRowActions,
  listedFileRowActions,
} from '#src/fileRowAccessibility'

const noop = (): void => undefined

// What no device spec reaches: no fixture has a failed send, an empty part or a verb on a row with
// no press; no driver performs a custom action; Android shows a clickable row's click regardless.

describe('what a file row is announced as on native', () => {
  it('leaves out a part that is empty', () => {
    expect(fileRowAccessibleName('notes', '', '')).toBe('notes')
  })
})

describe('the actions a file row offers on native', () => {
  it('retries a failed file on a double-tap, though the row takes no press of its own', () => {
    let retried = false
    const actions = fileRowActions({
      onAction: () => {
        retried = true
      },
      actionLabel: 'Retry',
    })
    expect(actions.map(({ name, label }) => [name, label])).toEqual([['activate', 'Retry']])
    actions[0]?.run()
    expect(retried).toBe(true)
  })

  it('takes the first verb as the press of a row with none, and keeps the rest', () => {
    const actions = fileRowActions({
      onOpen: noop,
      openLabel: 'View',
      onAction: noop,
      actionLabel: 'Export',
    })
    expect(actions.map(({ name, label }) => [name, label])).toEqual([
      ['activate', 'View'],
      ['control', 'Export'],
    ])
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

describe('the actions a file row lists as custom ones', () => {
  const actions = fileRowActions({
    onPress: noop,
    pressLabel: 'Open',
    onAction: noop,
    actionLabel: 'Export',
  })

  it('keeps the activation on Android, where it is the click TalkBack performs', () => {
    expect(listedFileRowActions(actions, 'android').map(({ name }) => name)).toEqual([
      'activate',
      'control',
    ])
  })

  it('lists nothing on iOS for a failed send, whose Retry is the double-tap', () => {
    const retry = fileRowActions({ onAction: noop, actionLabel: 'Retry' })
    expect(listedFileRowActions(retry, 'ios')).toEqual([])
  })
})
