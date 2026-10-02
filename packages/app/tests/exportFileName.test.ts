import { describe, expect, it } from 'vitest'

import { bareFileName } from '#src/exportFileName'

/**
 * The sender names an attachment, and that name ends up in a path on every platform. The step
 * both apps start from is that it names a file and nothing about where the file goes.
 */
describe("the bare name in a sender's suggestion", () => {
  it('keeps an ordinary name as it is', () => {
    expect(bareFileName('itinerary (final).pdf')).toBe('itinerary (final).pdf')
  })

  it('drops any directory part, whichever separator the sender used', () => {
    expect(bareFileName('../../.ssh/authorized_keys')).toBe('authorized_keys')
    expect(bareFileName('/etc/passwd')).toBe('passwd')
    expect(bareFileName('C:\\Windows\\x.dll')).toBe('x.dll')
    expect(bareFileName('..\\..\\startup/run.bat')).toBe('run.bat')
  })

  it('drops control characters', () => {
    expect(bareFileName('in\u0000voice\u001b[31m.pdf\u007f\n')).toBe('invoice[31m.pdf')
  })

  it('drops C1 and the controls that reorder text', () => {
    // Shown as `invoiceexe.pdf` while it would save as an executable.
    expect(bareFileName('invoice\u202efdp.exe')).toBe('invoicefdp.exe')
    expect(bareFileName('a\u2066b\u2069\u200e\u200f\u061c\u0085c.txt')).toBe('abc.txt')
  })

  it('leaves the caller to decide what stands in for nothing', () => {
    for (const nothing of ['', '   ', 'folder/', '\u0000\u0001', null, 42, undefined]) {
      expect(bareFileName(nothing)).toBe('')
    }
    expect(bareFileName('.')).toBe('.')
    expect(bareFileName('../..')).toBe('..')
  })
})
