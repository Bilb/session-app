import { describe, expect, it } from 'vitest'

import {
  NOTHING_HEARD,
  previewFailed,
  previewLoaded,
  stagedPreview,
  type StagedPreviewState,
} from '#src/stagedPreview'

const A = 'session-media://picked/aaaa'
const B = 'session-media://picked/bbbb'

/** What a tile draws after hearing `events`, in order, with `previewUrl` as its prop throughout. */
function after(
  previewUrl: string | undefined,
  events: readonly ['load' | 'error', string][],
): ReturnType<typeof stagedPreview> {
  let state: StagedPreviewState = NOTHING_HEARD
  for (const [event, url] of events) {
    state = event === 'load' ? previewLoaded(state, url) : previewFailed(state, url)
  }
  return stagedPreview(previewUrl, state)
}

describe("a staged tile's thumbnail", () => {
  it('is drawn hidden over the face until it loads, then shown', () => {
    expect(after(A, [])).toEqual({ url: A, shown: false })
    expect(after(A, [['load', A]])).toEqual({ url: A, shown: true })
  })

  it('is dropped for good once it fails, leaving the face', () => {
    expect(after(A, [['error', A]])).toEqual({ url: undefined, shown: false })
    expect(
      after(A, [
        ['load', A],
        ['error', A],
      ]),
    ).toEqual({ url: undefined, shown: false })
  })

  it('starts again for a new url, whatever the last one did', () => {
    expect(after(B, [['error', A]])).toEqual({ url: B, shown: false })
    expect(after(B, [['load', A]])).toEqual({ url: B, shown: false })
    expect(
      after(B, [
        ['load', A],
        ['load', B],
      ]),
    ).toEqual({ url: B, shown: true })
  })

  it('is nothing for a file with no picture', () => {
    expect(after(undefined, [])).toEqual({ url: undefined, shown: false })
  })
})
