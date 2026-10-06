import { describe, expect, it } from 'vitest'

import { toPlainText } from '#src/segments/toPlainText'

describe('toPlainText', () => {
  it('keeps line breaks as line breaks', () => {
    expect(toPlainText('My Account ID is<br/><br/>05abcd<br/><br/>Download it')).toBe(
      'My Account ID is\n\n05abcd\n\nDownload it',
    )
  })

  it('keeps the text of bold and span, without the tags', () => {
    expect(toPlainText('Delete <b>Alice</b> for <span>everyone</span>?')).toBe(
      'Delete Alice for everyone?',
    )
  })

  it('leaves a tag it does not know visible', () => {
    expect(toPlainText('a <i>b</i>')).toBe('a <i>b</i>')
  })
})
