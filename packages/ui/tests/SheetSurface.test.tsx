import { ELEMENT } from '@session/test-ids'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SheetSurface } from '#src/Sheet'
import { Text } from '#src/Text'

import { renderInUI } from './support/render'

function surface(wide: boolean, onClose = () => {}) {
  return renderInUI(
    <SheetSurface
      wide={wide}
      bottomInset={24}
      onClose={onClose}
      title="Attachments"
      closeLabel="Close"
      footer={<Text>2 of 5 uploaded</Text>}
      testID={ELEMENT.conversation.attachmentSheet}
      closeTestID={ELEMENT.conversation.attachmentSheetClose}
    >
      <Text>notes.pdf</Text>
    </SheetSurface>,
  )
}

describe('a sheet drawn outside its modal', () => {
  it('draws its title, body and footer, and closes from its cross', () => {
    const onClose = vi.fn()
    const { getByText, getByTestId } = surface(true, onClose)
    expect(getByText('Attachments')).toBeTruthy()
    expect(getByText('notes.pdf')).toBeTruthy()
    expect(getByText('2 of 5 uploaded')).toBeTruthy()
    fireEvent.click(getByTestId(ELEMENT.conversation.attachmentSheetClose))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps clear of the bottom inset only as a bottom sheet', () => {
    const padding = (wide: boolean) => {
      const { getByTestId, unmount } = surface(wide)
      const value = getComputedStyle(
        getByTestId(ELEMENT.conversation.attachmentSheet),
      ).paddingBottom
      unmount()
      return value
    }
    expect(padding(false)).toBe('24px')
    expect(padding(true)).not.toBe('24px')
  })
})
