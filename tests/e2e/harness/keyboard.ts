import type { ElementId } from '@session/test-ids'

import type { DesktopApp, FocusedStop } from './DesktopApp'
import type { AccessibleNode } from './ISessionApp'

/** A focus stop, and what a screen reader says of it; null for one carrying no test id. */
export interface Stop extends FocusedStop {
  node: AccessibleNode | null
}

/** Far more stops than a seeded conversation has, so a walk that never wraps fails. */
const MAX_STOPS = 150

async function tab(app: DesktopApp): Promise<Stop | null> {
  await app.page.keyboard.press('Tab')
  const stop = await app.focusedStop()
  if (stop === null) return null
  return {
    ...stop,
    node: stop.testID === null ? null : await app.describe(stop.testID as ElementId, stop.at),
  }
}

/**
 * Every focus stop in the window once round, in Tab order. Chromium resumes Tab from where focus
 * last was rather than from the top, so the walk starts anywhere and ends back at its first stop.
 */
export async function tabStops(app: DesktopApp): Promise<Stop[]> {
  const stops: Stop[] = []
  for (let step = 0; step < MAX_STOPS; step++) {
    const stop = await tab(app)
    // Focus passes through the page itself on its way round.
    if (stop === null) continue
    const first = stops[0]
    if (first !== undefined && first.testID === stop.testID && first.at === stop.at) return stops
    stops.push(stop)
  }
  throw new Error(`still tabbing after ${String(MAX_STOPS)} stops`)
}

/** Tabs until `wanted` has focus. */
export async function tabTo(app: DesktopApp, wanted: (stop: Stop) => boolean): Promise<Stop> {
  for (let step = 0; step < MAX_STOPS; step++) {
    const stop = await tab(app)
    if (stop !== null && wanted(stop)) return stop
  }
  throw new Error('Tab never reached it')
}
