import { describe, expect, it } from 'vitest'

import { DATE_HEADER_GAP_MS, showsDateHeader } from '#src/dateHeaders'

const at = (day: number, hour: number, minute = 0): { timestamp: number } => ({
  timestamp: new Date(2023, 7, day, hour, minute).getTime(),
})

describe('a date header', () => {
  it('starts after more than five minutes since the message before', () => {
    const before = at(16, 9, 0)
    expect(
      showsDateHeader(before, { timestamp: before.timestamp + DATE_HEADER_GAP_MS }, false),
    ).toBe(false)
    expect(
      showsDateHeader(before, { timestamp: before.timestamp + DATE_HEADER_GAP_MS + 1 }, false),
    ).toBe(true)
  })

  it('starts on a new day, however close to midnight', () => {
    expect(showsDateHeader(at(15, 23, 59), at(16, 0, 1), false)).toBe(true)
  })

  it('goes above the first message only when it is the oldest in the conversation', () => {
    expect(showsDateHeader(undefined, at(16, 9), true)).toBe(true)
    expect(showsDateHeader(undefined, at(16, 9), false)).toBe(false)
  })
})
