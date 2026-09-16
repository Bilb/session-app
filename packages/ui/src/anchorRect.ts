/** Where an element sits in the window, in the coordinates a full-screen overlay is laid out in. */
export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * What the two platforms offer for measuring an element, neither of which the other has.
 *
 * Feature-detected rather than split into `.native.ts` and `.ts`, because the question is which
 * API the object in hand actually has. Tamagui renders a real DOM node on the web and a react-native
 * host component on a device, and this is the one place that difference shows.
 */
interface MeasurableNode {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number }
}

/**
 * Measures an element and hands back where it is, or null when it cannot be measured.
 *
 * Asynchronous because the native half is: `measureInWindow` goes to the UI thread and answers in
 * a callback. Null rather than a guess when there is nothing to measure -- a control positioned
 * against a made-up rectangle lands somewhere arbitrary, which is worse than not moving at all.
 */
export function measureAnchor(node: unknown, onMeasured: (rect: AnchorRect | null) => void): void {
  const measurable = node as MeasurableNode | null
  if (measurable === null || measurable === undefined) {
    onMeasured(null)
    return
  }

  if (typeof measurable.measureInWindow === 'function') {
    measurable.measureInWindow((x, y, width, height) => {
      onMeasured({ x, y, width, height })
    })
    return
  }

  if (typeof measurable.getBoundingClientRect === 'function') {
    const rect = measurable.getBoundingClientRect()
    onMeasured({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
    return
  }

  onMeasured(null)
}

/**
 * Where to put a panel of `panelWidth` hanging off `anchor`, trailing edges aligned.
 *
 * **Aligned to the trigger's trailing edge**, because the trigger is a small control with a
 * chevron and the panel is wider than it: hanging the panel's leading edge off the trigger's would
 * push it off the far side of the window wherever the trigger sits near that edge, which is where
 * this one usually does. Which edge that is mirrors -- the trigger sits in the top trailing corner
 * either way, so the panel has to grow back toward the middle either way.
 *
 * **The answer is a physical offset and that is deliberate.** It is a window coordinate handed to
 * `left`, because the panel is placed against a measured rectangle rather than laid out in flow,
 * and a measurement is physical. Only the choice of which edge to align is direction-dependent.
 *
 * Clamped to the window on both sides, so the panel is always whole. The margin is the smallest
 * gap worth keeping between it and the window edge.
 */
export function panelLeft(
  anchor: AnchorRect,
  panelWidth: number,
  windowWidth: number,
  margin: number,
  rtl = false,
): number {
  const aligned = rtl ? anchor.x : anchor.x + anchor.width - panelWidth
  return Math.max(margin, Math.min(aligned, windowWidth - panelWidth - margin))
}

export interface PanelPlacement {
  /** Which side of the anchor the panel hangs off. */
  side: 'below' | 'above'
  /** Distance from the window's top edge when below, from its bottom edge when above. */
  offset: number
  /** How tall the panel may grow on that side. */
  available: number
}

/**
 * Which side of the trigger the panel opens on, and how much room it has there.
 *
 * Below by default, because that is what a chevron pointing down promises. It flips above only
 * when below genuinely cannot hold the panel and above can hold more of it -- not merely when
 * above is roomier, since a flip that buys nothing is just a control that moves unpredictably.
 *
 * `available` is what the caller caps the list at, so a panel near an edge scrolls internally
 * rather than running off the screen. The trigger's own position is the thing that varies here:
 * it is beside the buttons mid-screen on a desktop window and in the top corner on a phone.
 */
export function panelPlacement(
  anchor: AnchorRect,
  windowHeight: number,
  gap: number,
  margin: number,
  minHeight: number,
): PanelPlacement {
  const below = windowHeight - anchor.y - anchor.height - gap - margin
  const above = anchor.y - gap - margin
  if (below >= minHeight || below >= above) {
    return { side: 'below', offset: anchor.y + anchor.height + gap, available: below }
  }
  return { side: 'above', offset: windowHeight - anchor.y + gap, available: above }
}
