import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContextMenuTarget } from '#src/ContextMenuTarget'
import { PressArea } from '#src/PressArea'
import { Text } from '#src/Text'

import { renderInUI } from './support/render'

/** A message with words and a control of its own, as one with a quote or a file has. */
function target(onDoublePress: (() => void) | undefined) {
  return renderInUI(
    <ContextMenuTarget onOpen={() => {}} onDoublePress={onDoublePress}>
      <Text testID="words">Are we still on for Thursday?</Text>
      <PressArea onPress={() => {}} accessibilityLabel="Download" testID="control">
        {() => <Text>Download</Text>}
      </PressArea>
    </ContextMenuTarget>,
  )
}

function select(node: Node): void {
  const range = document.createRange()
  range.selectNodeContents(node)
  const selection = getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('a double-click on a message', () => {
  it('is reported, and its second press selects no word', () => {
    const onDoublePress = vi.fn()
    const { getByTestId } = target(onDoublePress)
    const words = getByTestId('words')

    // False from fireEvent: the default, which would select the word, was prevented.
    expect(fireEvent.mouseDown(words, { detail: 2 })).toBe(false)
    fireEvent.doubleClick(words)

    expect(onDoublePress).toHaveBeenCalledOnce()
  })

  it('leaves a single press alone', () => {
    const { getByTestId } = target(vi.fn())
    expect(fireEvent.mouseDown(getByTestId('words'), { detail: 1 })).toBe(true)
  })

  it('is the selection’s while text is selected, which it then keeps', () => {
    const onDoublePress = vi.fn()
    const { getByTestId } = target(onDoublePress)
    const words = getByTestId('words')
    select(words)

    expect(fireEvent.mouseDown(words, { detail: 2 })).toBe(true)
    fireEvent.doubleClick(words)

    expect(onDoublePress).not.toHaveBeenCalled()
    getSelection()?.removeAllRanges()
  })

  it('is the control’s when it lands on one inside the message', () => {
    const onDoublePress = vi.fn()
    const { getByTestId } = target(onDoublePress)
    fireEvent.doubleClick(getByTestId('control'))
    expect(onDoublePress).not.toHaveBeenCalled()
  })

  it('does nothing where the message takes none', () => {
    const { getByTestId } = target(undefined)
    expect(fireEvent.mouseDown(getByTestId('words'), { detail: 2 })).toBe(true)
  })
})
