import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { pressArea } from '@session/expectations'
import { ELEMENT } from '@session/test-ids'

import { PressArea } from '#src/PressArea'
import { Text } from '#src/Text'

import { byId, declared, nodeOf } from '@session/render-tier'
import { renderInUI } from './support/render'

const ID = ELEMENT.settings.back

function area({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <PressArea onPress={onPress} disabled={disabled} accessibilityLabel="Back" testID={ID}>
      {() => <Text>Back</Text>}
    </PressArea>
  )
}

describe('the web PressArea', () => {
  it('stacks its child in a column, as the native half’s Pressable does', () => {
    renderInUI(area({ onPress: () => {} }))
    expect(declared(byId(ID))['flex-direction']).toBe('column')
  })

  it('is a named stop that a click, Enter and Space press', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    renderInUI(area({ onPress }))
    expect(nodeOf(ID)).toMatchObject(pressArea({ name: 'Back' }).desktop!)
    await user.tab()
    expect(document.activeElement).toBe(byId(ID))
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(byId(ID))
    expect(onPress).toHaveBeenCalledTimes(3)
  })

  it('is no stop and presses nothing while disabled', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    renderInUI(area({ onPress, disabled: true }))
    expect(nodeOf(ID)).toMatchObject(pressArea({ name: 'Back', disabled: true }).desktop!)
    await user.tab()
    expect(document.activeElement).toBe(document.body)
    byId(ID).focus()
    await user.keyboard('{Enter}')
    expect(onPress).not.toHaveBeenCalled()
  })
})
