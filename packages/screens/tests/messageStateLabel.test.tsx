import type { Message } from '@session/client'
import { tr } from '@session/localization'
import { describe, expect, it } from 'vitest'

import { stateLabel } from '#src/MessageRow'

const message = (sendState: Message['sendState'], attachments = 0) =>
  ({ sendState, attachments: Array.from({ length: attachments }) }) as unknown as Message

describe('what a message says about its send', () => {
  it('says an interrupted send failed, as it does a failed one', () => {
    expect(stateLabel(message('interrupted'))).toBe(tr('messageStatusFailedToSend'))
    expect(stateLabel(message('interrupted', 3))).toBe(tr('messageStatusFailedToSend'))
    expect(stateLabel(message('failed'))).toBe(tr('messageStatusFailedToSend'))
  })

  it('says nothing once sent', () => {
    expect(stateLabel(message('sent'))).toBeUndefined()
  })
})
