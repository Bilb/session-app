import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ELEMENT } from '@session/test-ids'

import { LANDING_FADE_MS } from '#src/landingMetrics'
import { MessageFrame } from '#src/MessageFrame'

import { nodeOf } from '@session/render-tier'
import { renderInUI } from './support/render'

const ID = ELEMENT.conversation.messageHighlight

function reduceMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
  }))
}

function frame(serial: number | undefined) {
  return (
    <MessageFrame outgoing={false} highlightSerial={serial}>
      {null}
    </MessageFrame>
  )
}

const drawn = () => document.querySelector(`[data-testid="${ID}"]`)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the highlight a jump lands with', () => {
  it('is not drawn on a message never landed on', () => {
    reduceMotion(false)
    renderInUI(frame(undefined))
    expect(drawn()).toBeNull()
  })

  it('is hidden from a screen reader, which is given focus instead', () => {
    reduceMotion(false)
    renderInUI(frame(1))
    expect(drawn()).not.toBeNull()
    expect(nodeOf(ID)).toBeNull()
  })

  it('under reduced motion is shown, then removed after the fade’s time with no fade', () => {
    reduceMotion(true)
    renderInUI(frame(1))
    expect(drawn()?.getAttribute('style') ?? '').not.toContain('transition')
    act(() => {
      vi.advanceTimersByTime(LANDING_FADE_MS - 1)
    })
    expect(drawn()).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(drawn()).toBeNull()
  })

  it('plays again on a second jump to the same message', () => {
    reduceMotion(true)
    const { rerender } = renderInUI(frame(1))
    act(() => {
      vi.advanceTimersByTime(LANDING_FADE_MS)
    })
    expect(drawn()).toBeNull()
    rerender(frame(2))
    expect(drawn()).not.toBeNull()
  })

  it('fades out once it has been drawn, and is gone when the fade ends', () => {
    reduceMotion(false)
    renderInUI(frame(1))
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(drawn()?.getAttribute('style') ?? '').toContain('transition')
    act(() => {
      vi.advanceTimersByTime(LANDING_FADE_MS)
    })
    expect(drawn()).toBeNull()
  })
})
