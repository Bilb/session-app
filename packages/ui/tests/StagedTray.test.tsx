import { ELEMENT } from '@session/test-ids'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StagedTray } from '#src/StagedTray'

import { renderInUI } from './support/render'

/** jsdom lays nothing out, so this reports every observed view as laid out the moment it is. */
class LaidOutAtOnce {
  constructor(private readonly heard: (entries: Array<{ target: Element }>) => void) {}
  observe(target: Element) {
    this.heard([{ target }])
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', LaidOutAtOnce)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function tray(startOffset?: number) {
  return (
    <StagedTray
      countLabel="16 / 32"
      countSpokenLabel="16 of 32 attachments"
      clearLabel="Clear"
      onClear={() => {}}
      addLabel="Add attachment"
      onAdd={() => {}}
      previousLabel="Previous"
      nextLabel="Next"
      startOffset={startOffset}
      testID={ELEMENT.conversation.stagedTray}
      clearTestID={ELEMENT.conversation.stagedClear}
      addTestID={ELEMENT.conversation.stagedAdd}
      previousTestID={ELEMENT.conversation.stagedPrevious}
      nextTestID={ELEMENT.conversation.stagedNext}
    >
      {null}
    </StagedTray>
  )
}

describe('StagedTray', () => {
  it('starts at the offset it is given, without animating there, once', async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scroll').mockImplementation(() => {})
    const { rerender } = renderInUI(tray(720))
    await vi.waitFor(() => {
      expect(scroll).toHaveBeenCalled()
    })
    rerender(tray(720))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(scroll.mock.calls).toEqual([[{ left: 720, top: 0, behavior: 'auto' }]])
  })

  it('starts at its leading edge when given no offset', async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, 'scroll').mockImplementation(() => {})
    renderInUI(tray())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(scroll).not.toHaveBeenCalled()
  })
})
