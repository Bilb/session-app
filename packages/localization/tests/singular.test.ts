import { describe, expect, it } from 'vitest'

import { singular } from '#src/singular'

describe('a plural string read for one', () => {
  it('is the singular form, with no count left to fill in', () => {
    expect(singular('messageNewYouveGot')).toBe("You've got a new message.")
  })
})
