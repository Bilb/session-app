import { describe, expect, it } from 'vitest'

import { conversationTitle } from './conversationTitle'

describe('conversationTitle', () => {
  const id = '057fb21c9829fc64380e4d4533635fa23be834a994e40b52cfbc211ede12805d30'

  it('prefers a nickname over the display name', () => {
    expect(conversationTitle({ id, nickname: 'Ada', displayName: 'ada.eth' })).toBe('Ada')
  })

  it('falls back to the display name', () => {
    expect(conversationTitle({ id, displayName: 'ada.eth' })).toBe('ada.eth')
  })

  it('shortens the account id when nobody has shared a name', () => {
    expect(conversationTitle({ id, displayName: '' })).toBe('057fb21c…805d30')
  })

  it('treats a blank name as no name', () => {
    expect(conversationTitle({ id, nickname: '   ', displayName: '' })).toBe('057fb21c…805d30')
  })

  it('leaves an id short enough to read alone', () => {
    expect(conversationTitle({ id: '05abc', displayName: '' })).toBe('05abc')
  })
})
