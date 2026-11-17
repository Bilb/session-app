import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProgressRing } from '#src/ProgressRing'
import { MORPH_RING_MS } from '#src/updateIndicatorTiming'

import { renderInUI } from './support/render'

const SIZE = 20

/** The ring's strokes, track first: the fill and the waiting arc follow it. */
const strokes = (container: HTMLElement) => [...container.querySelectorAll('circle')]

const waiting = (still = false) => <ProgressRing size={SIZE} indeterminate still={still} />
const reading = (progress: number, still = false) => (
  <ProgressRing size={SIZE} progress={progress} still={still} />
)

/**
 * The timing a picture cannot show: a capture is of one moment, and the catalog only ever draws a
 * ring that mounted in its state.
 */
describe('a ring whose first reading arrives', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits on a closed track, then opens its gap before it draws the fill', () => {
    const { container, rerender } = renderInUI(waiting())
    expect(strokes(container)[0]?.getAttribute('stroke-dasharray')).toBeNull()

    rerender(reading(0.4))
    const opening = strokes(container)
    expect(opening).toHaveLength(1)
    expect(opening[0]?.getAttribute('stroke-dasharray')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(MORPH_RING_MS / 2)
    })
    expect(strokes(container)).toHaveLength(1)
    expect(strokes(container)[0]?.getAttribute('stroke-dasharray')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(MORPH_RING_MS)
    })
    expect(strokes(container)).toHaveLength(2)
  })

  it('opens at once when asked for no motion', () => {
    const { container, rerender } = renderInUI(waiting(true))
    rerender(reading(0.4, true))
    expect(strokes(container)).toHaveLength(2)
  })

  it('draws a reading at once when it never waited', () => {
    const { container } = renderInUI(reading(0.4))
    expect(strokes(container)).toHaveLength(2)
  })
})
