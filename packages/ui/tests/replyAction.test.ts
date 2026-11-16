import { describe, expect, it } from 'vitest'

import { replyAction } from '#src/replyAction'

describe('Reply as an accessibility action', () => {
  it('is nothing on the desktop, where the message menu offers it', () => {
    expect(replyAction('Reply', () => {})).toEqual({})
  })
})
