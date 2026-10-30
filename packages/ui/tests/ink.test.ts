import { describe, expect, it } from 'vitest'

import { inkFor, type InkTone } from '#src/ink'

const TONES: InkTone[] = ['primary', 'secondary', 'danger', 'link']

describe('ink on an accent fill', () => {
  it('is an on-colour in every tone, whatever the tone draws on the page', () => {
    for (const tone of TONES.filter((t) => t !== 'secondary'))
      expect(inkFor(tone, 'accent').color).toBe('$onAccent')
    expect(inkFor('secondary', 'accent').color).toBe('$onAccentSecondary')
  })
})

describe('ink on the page', () => {
  it('is the tone’s own role, and danger as text is the text role, not the fill', () => {
    expect(inkFor('primary', 'page').color).toBe('$textPrimary')
    expect(inkFor('secondary', 'page').color).toBe('$textSecondary')
    expect(inkFor('danger', 'page').color).toBe('$dangerText')
    expect(inkFor('link', 'page').color).toBe('$accentText')
  })
})

describe('ink on a received bubble', () => {
  it('says a failure in the bubble’s text and keeps only the glyph red', () => {
    expect(inkFor('danger', 'received').color).toBe('$messageBubbleIncomingText')
    expect(inkFor('danger', 'received', 'glyph').color).toBe('$dangerText')
    for (const tone of TONES.filter((t) => t !== 'danger'))
      expect(inkFor(tone, 'received')).toEqual(inkFor(tone, 'page'))
  })
})
