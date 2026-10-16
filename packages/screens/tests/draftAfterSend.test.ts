import { describe, expect, it } from 'vitest'

import { draftAfterSend } from '#src/draftAfterSend'

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
  })
})
