import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'

import { coalesced } from '#src/coalesce'

describe('coalesced', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function watched(): {
    set: (n: number) => void
    told: number[]
    stop: () => void
  } {
    const store = createStore(() => ({ n: 0 }))
    const told: number[] = []
    const stop = coalesced(store, 16).subscribe((state) => told.push(state.n))
    return { set: (n) => store.setState({ n }), told, stop }
  }

  it('tells a lone change at once', () => {
    const { set, told } = watched()
    set(1)
    expect(told).toEqual([1])
  })

  it('tells the rest of a burst once, with the last state', () => {
    const { set, told } = watched()
    set(1)
    set(2)
    set(3)
    expect(told).toEqual([1])

    vi.advanceTimersByTime(16)
    expect(told).toEqual([1, 3])
  })

  it('keeps holding back while changes keep coming, and tells at once after a quiet window', () => {
    const { set, told } = watched()
    set(1)
    vi.advanceTimersByTime(10)
    set(2)
    vi.advanceTimersByTime(6)
    expect(told).toEqual([1, 2])

    // Inside the window the trailing tell opened.
    set(3)
    expect(told).toEqual([1, 2])
    vi.advanceTimersByTime(16)
    expect(told).toEqual([1, 2, 3])

    vi.advanceTimersByTime(16)
    set(4)
    expect(told).toEqual([1, 2, 3, 4])
  })

  it('reads the store as it is now, whatever has been told', () => {
    const store = createStore(() => ({ n: 0 }))
    const drawn = coalesced(store, 16)
    const stop = drawn.subscribe(() => undefined)
    store.setState({ n: 1 })
    store.setState({ n: 2 })

    expect(drawn.getState().n).toBe(2)
    stop()
  })

  it('holds a change a listener makes while being told, on one timer', () => {
    const store = createStore(() => ({ n: 0 }))
    const told: number[] = []
    const stop = coalesced(store, 16).subscribe((state) => {
      told.push(state.n)
      if (state.n === 2) store.setState({ n: 3 })
    })

    store.setState({ n: 1 })
    store.setState({ n: 2 })
    vi.advanceTimersByTime(16)
    expect(told).toEqual([1, 2])
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(16)
    expect(told).toEqual([1, 2, 3])
    stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('tells nobody after the last listener left', () => {
    const { set, told, stop } = watched()
    set(1)
    set(2)
    stop()
    vi.advanceTimersByTime(100)
    expect(told).toEqual([1])
    expect(vi.getTimerCount()).toBe(0)
  })
})
