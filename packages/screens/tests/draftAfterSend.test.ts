import { describe, expect, it } from 'vitest'

import { draftAfterSend, followSent } from '#src/draftAfterSend'

describe('the draft once a send went', () => {
  it('is empty when nothing was typed meanwhile', () => {
    expect(draftAfterSend('hello ', 'hello ')).toBe('')
    expect(draftAfterSend('hello  ', 'hello')).toBe('')
  })

  it('keeps only what was typed after the sent text', () => {
    expect(draftAfterSend('hello world', 'hello')).toBe('world')
  })

  it('keeps all of it when the sent text was edited', () => {
    expect(draftAfterSend('hullo world', 'hello')).toBe('hullo world')
    expect(draftAfterSend('okay', null)).toBe('okay')
  })
})

describe('the sent text followed through the edits made while it is out', () => {
  it('is kept while every edit still starts with it', () => {
    expect(['ok ', 'ok t', 'ok there'].reduce(followSent, 'ok')).toBe('ok')
  })

  it('is lost for good once the draft was cleared, whatever is retyped', () => {
    expect(['', 'o', 'ok', 'okay'].reduce(followSent, 'ok')).toBeNull()
  })
})
