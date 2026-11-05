import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { pressArea } from '@session/expectations'
import { ELEMENT } from '@session/test-ids'

import { ScrollToLatest } from '#src/ScrollToLatest'

import { byId, nodeOf } from '@session/render-tier'
import { renderInUI } from './support/render'

const ID = ELEMENT.conversation.scrollToLatest

describe('the scroll-to-latest button', () => {
  it.each([
    [false, 'Scroll to latest message'],
    [true, 'Back to reply'],
  ])('is one button named for where it goes (returning to a reply: %s)', (returns, label) => {
    renderInUI(
      <ScrollToLatest
        returnsToReply={returns}
        accessibilityLabel={label}
        onPress={() => {}}
        testID={ID}
      />,
    )
    expect(nodeOf(ID)).toMatchObject(pressArea({ name: label }).desktop!)
  })

  it('takes the pointer and the keyboard', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    renderInUI(
      <ScrollToLatest
        returnsToReply={false}
        accessibilityLabel="Go"
        onPress={onPress}
        testID={ID}
      />,
    )
    await user.click(byId(ID))
    byId(ID).focus()
    await user.keyboard('{Enter}')
    expect(onPress).toHaveBeenCalledTimes(2)
  })
})
