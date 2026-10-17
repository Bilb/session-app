import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ANNOUNCE_SETTLE_MS, scheduleAnnouncement, type Speaker } from '#src/announce'

function recorder(): { speaker: Speaker; said: string[] } {
  const said: string[] = []
  return {
    said,
    speaker: {
      announceForAccessibility: (text) => said.push(`now:${text}`),
      announceForAccessibilityWithOptions: (text, { queue }) =>
        said.push(`${queue === true ? 'queued' : 'now'}:${text}`),
    },
  }
}

describe('an announcement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for a closing picker to settle before it is said, once', () => {
    const { speaker, said } = recorder()
    scheduleAnnouncement('Too large', 'android', speaker)
    vi.advanceTimersByTime(ANNOUNCE_SETTLE_MS - 1)
    expect(said).toEqual([])
    vi.advanceTimersByTime(1)
    vi.advanceTimersByTime(ANNOUNCE_SETTLE_MS * 2)
    expect(said).toEqual(['now:Too large'])
  })

  it('queues behind what VoiceOver is saying on iOS, rather than cutting in', () => {
    const { speaker, said } = recorder()
    scheduleAnnouncement('Too large', 'ios', speaker)
    vi.runAllTimers()
    expect(said).toEqual(['queued:Too large'])
  })

  it('says nothing once overtaken', () => {
    const { speaker, said } = recorder()
    const cancel = scheduleAnnouncement('Too large', 'ios', speaker)
    cancel()
    vi.runAllTimers()
    expect(said).toEqual([])
  })
})
