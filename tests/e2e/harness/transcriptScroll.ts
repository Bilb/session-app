import type { Locator } from '@playwright/test'

/** Far more steps than the showcase is tall at the narrowest width. */
export const MAX_SCROLL_STEPS = 60

/**
 * Scrolls the tallest scrolled box under `screen` by most of its height, `direction` -1 towards its
 * start; false when it was already at that end.
 */
export async function scrollStep(screen: Locator, direction: -1 | 1): Promise<boolean> {
  const moved = await screen.evaluate((root, sign) => {
    interface Box {
      scrollTop: number
      scrollHeight: number
      clientHeight: number
      querySelectorAll(selector: string): ArrayLike<Box>
    }
    const boxes = Array.from((root as unknown as Box).querySelectorAll('*')).filter(
      (box) => box.scrollHeight > box.clientHeight + 1,
    )
    const box = boxes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
    if (box === undefined) return false
    const before = box.scrollTop
    box.scrollTop += sign * box.clientHeight * 0.8
    return box.scrollTop !== before
  }, direction)
  // Two frames: one for the windowed list to mount the rows now in view, one for them to draw.
  await screen.page().evaluate(
    () =>
      new Promise<void>((resolve) => {
        const g = globalThis as unknown as { requestAnimationFrame: (callback: () => void) => void }
        g.requestAnimationFrame(() => g.requestAnimationFrame(resolve))
      }),
  )
  return moved
}

/**
 * Scrolls `screen` until `target` is mounted: towards its start first, since a conversation opens
 * on its newest page and reads older ones in as the start comes near, then back towards its end.
 * The transcript is a windowed list, so a message far from where it opens is not in the page at
 * all until it is scrolled near, and Playwright's own scrolling only reaches what is mounted.
 */
export async function scrollUntilMounted(screen: Locator, target: Locator): Promise<void> {
  for (const direction of [-1, 1] as const)
    for (let step = 0; step < MAX_SCROLL_STEPS; step++) {
      if ((await target.count()) > 0) return
      if (!(await scrollStep(screen, direction))) break
    }
}
