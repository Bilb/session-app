import { describe, expect, it } from 'vitest'

import { formatDateHeader } from '#src/conversationTime'

/** Built from local fields, as in the conversation-time tests. Wednesday 16 August 2023, 14:30. */
const NOW = new Date(2023, 7, 16, 14, 30).getTime()
const at = (day: number, hour: number, minute = 0, month = 7, year = 2023): number =>
  new Date(year, month, day, hour, minute).getTime()

const US = { locale: 'en-US' } as const
const GB = { locale: 'en-GB' } as const

describe('a date header', () => {
  it('shows the time alone today', () => {
    expect(formatDateHeader(at(16, 9, 5), NOW, US)).toBe('9:05 AM')
    expect(formatDateHeader(at(16, 9, 5), NOW, GB)).toBe('09:05')
  })

  it('shows the weekday and the time in the six days before today', () => {
    expect(formatDateHeader(at(15, 23, 59), NOW, US)).toBe('Tue 11:59 PM')
    expect(formatDateHeader(at(10, 8, 0), NOW, GB)).toBe('Thu 08:00')
  })

  it('keeps the time on an older date, with no year this year', () => {
    expect(formatDateHeader(at(9, 18, 0), NOW, US)).toBe('Aug 9, 6:00 PM')
    expect(formatDateHeader(at(9, 18, 0), NOW, GB)).toBe('9 Aug, 18:00')
  })

  it('adds the year to a date from another year', () => {
    expect(formatDateHeader(at(31, 23, 0, 11, 2022), NOW, GB)).toBe('31 Dec 2022, 23:00')
  })

  it('uses the chosen date layout when one is set', () => {
    expect(formatDateHeader(at(9, 18, 0), NOW, { ...GB, dateFormat: 'DD/MM/YYYY' })).toBe(
      '09/08/2023 18:00',
    )
  })

  it('reads a day ahead, from a sender running fast, as a date', () => {
    expect(formatDateHeader(at(17, 9, 0), NOW, GB)).toBe('17 Aug, 09:00')
  })
})
