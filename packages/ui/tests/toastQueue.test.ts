import { describe, expect, it } from 'vitest'

import { TOAST_LIMIT, withoutToast, withToast, type QueuedToast } from '#src/toastQueue'

function toast(id: string, serial: number): QueuedToast {
  return { id, text: id, serial }
}

describe('the toast queue', () => {
  it('puts the newest first', () => {
    const queue = withToast(withToast([], toast('a', 1)), toast('b', 2))
    expect(queue.map((held) => held.id)).toEqual(['b', 'a'])
  })

  /** Copying twice should not stack two "Copied"s: the second one is the first, shown again. */
  it('replaces a toast with the same id rather than repeating it', () => {
    const queue = withToast(withToast([toast('b', 2)], toast('copied', 3)), toast('copied', 4))
    expect(queue).toEqual([toast('copied', 4), toast('b', 2)])
  })

  it('drops the oldest beyond the limit', () => {
    let queue: QueuedToast[] = []
    for (let n = 0; n <= TOAST_LIMIT; n += 1) queue = withToast(queue, toast(`t${String(n)}`, n))
    expect(queue).toHaveLength(TOAST_LIMIT)
    expect(queue.at(-1)?.id).toBe('t1')
  })

  /** An expired timer for a toast since replaced must not take the replacement with it. */
  it('removes only the showing it names', () => {
    const queue = withToast([toast('copied', 1)], toast('copied', 2))
    expect(withoutToast(queue, 1)).toEqual([toast('copied', 2)])
    expect(withoutToast(queue, 2)).toEqual([])
  })
})
