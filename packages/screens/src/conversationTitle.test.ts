import { describe, expect, it } from 'vitest'

import { conversationTitle } from './conversationTitle'

const id = '057fb21c2cd7e0b1a2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6805d30'

describe('conversationTitle', () => {
  it('prefers a nickname', () => {
    expect(conversationTitle({ id, nickname: 'Ada', displayName: 'ada.eth' })).toBe('Ada')
  })

  it('falls back to the display name', () => {
    expect(conversationTitle({ id, displayName: 'ada.eth' })).toBe('ada.eth')
  })

  it('falls through a blank nickname to the display name', () => {
    // `??` would have stopped here and rendered the blank, which is the bug this replaced.
    expect(conversationTitle({ id, nickname: '   ', displayName: 'ada.eth' })).toBe('ada.eth')
    expect(conversationTitle({ id, nickname: '', displayName: 'ada.eth' })).toBe('ada.eth')
  })

  it('trims the name it returns', () => {
    expect(conversationTitle({ id, nickname: '  Ada  ' })).toBe('Ada')
    expect(conversationTitle({ id, displayName: '\tada.eth\n' })).toBe('ada.eth')
  })

  it('shortens the account id when there is no name, the way desktop does', () => {
    // session-desktop's PubKey.shorten: four each side, three dots, parenthesised.
    expect(conversationTitle({ id, displayName: '' })).toBe('(057f...5d30)')
    expect(conversationTitle({ id, nickname: '   ', displayName: '' })).toBe('(057f...5d30)')
    expect(conversationTitle({ id })).toBe('(057f...5d30)')
  })

  it('leaves an id too short to shorten alone', () => {
    expect(conversationTitle({ id: '05abcdef', displayName: '' })).toBe('05abcdef')
  })
})
