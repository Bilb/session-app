import { describe, expect, it } from 'vitest'

import { parseMarkupSegments } from '#src/segments/parseMarkupSegments'

describe('parseMarkupSegments', () => {
  it('leaves a plain string as one text segment', () => {
    expect(parseMarkupSegments('Hello there')).toEqual([{ type: 'text', value: 'Hello there' }])
  })

  it('pulls bold out of the surrounding text', () => {
    expect(parseMarkupSegments('Delete <b>Alice</b> for everyone?')).toEqual([
      { type: 'text', value: 'Delete ' },
      { type: 'bold', value: 'Alice' },
      { type: 'text', value: ' for everyone?' },
    ])
  })

  it('turns a line break into text every renderer can draw', () => {
    expect(parseMarkupSegments('First<br/>Second')).toEqual([
      { type: 'text', value: 'First' },
      { type: 'text', value: '\n' },
      { type: 'text', value: 'Second' },
    ])
  })

  it('accepts both spellings of the break tag', () => {
    expect(parseMarkupSegments('a<br>b')).toEqual(parseMarkupSegments('a<br/>b'))
  })

  it('keeps the content of a span, which only groups text', () => {
    expect(parseMarkupSegments('Sent to <span>Bob</span>')).toEqual([
      { type: 'text', value: 'Sent to ' },
      { type: 'text', value: 'Bob' },
    ])
  })

  it('handles several tags in one string', () => {
    expect(parseMarkupSegments('<b>A</b> and <b>B</b><br/>done')).toEqual([
      { type: 'bold', value: 'A' },
      { type: 'text', value: ' and ' },
      { type: 'bold', value: 'B' },
      { type: 'text', value: '\n' },
      { type: 'text', value: 'done' },
    ])
  })

  it('leaves a tag it does not know as text rather than dropping it', () => {
    // A new tag in the catalogue should look wrong on screen, not disappear.
    expect(parseMarkupSegments('a <i>b</i>')).toEqual([{ type: 'text', value: 'a <i>b</i>' }])
  })
})
