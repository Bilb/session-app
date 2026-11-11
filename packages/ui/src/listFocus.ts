import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import { isWeb } from 'tamagui'

/** Which row Tab enters a list on before any row has been focused. */
export type ListFocusEntry = 'first' | 'last'

/**
 * The row that is the list's one tab stop: the row last focused while it is drawn, otherwise the
 * drawn row nearest to it, or to the entry end when none was focused or it has gone.
 *
 * Nearest rather than exact because a long list draws only a window of its rows, and a stop that
 * is not drawn is no stop at all: Tab would skip the list.
 */
export function stopKey(
  keys: readonly string[],
  drawn: ReadonlySet<string>,
  active: string | null,
  entry: ListFocusEntry,
): string | null {
  if (active !== null && drawn.has(active)) return active
  const activeAt = active === null ? -1 : keys.indexOf(active)
  const target = activeAt !== -1 ? activeAt : entry === 'last' ? keys.length - 1 : 0
  let best: string | null = null
  let bestDistance = Infinity
  keys.forEach((key, index) => {
    if (!drawn.has(key)) return
    const distance = Math.abs(index - target)
    if (distance < bestDistance) {
      best = key
      bestDistance = distance
    }
  })
  return best
}

/** The key `delta` rows from `from`, or null past either end: the list does not wrap. */
export function stepKey(keys: readonly string[], from: string, delta: 1 | -1): string | null {
  const at = keys.indexOf(from)
  if (at === -1) return null
  return keys[at + delta] ?? null
}

interface FocusableNode {
  focus: (options?: { preventScroll?: boolean }) => void
  scrollIntoView?: (options?: { block?: 'nearest' }) => void
}

/**
 * One list's roving tab stop, outside React's state so that moving it re-renders only the two
 * rows whose stop changes rather than every row the list holds.
 */
export class ListFocus {
  private keys: readonly string[] = []
  private readonly drawn = new Map<string, FocusableNode>()
  private active: string | null = null
  private stop: string | null = null
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly entry: ListFocusEntry,
    /** Up and Down step backwards through the data in an inverted list. */
    private readonly inverted: boolean,
  ) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly currentStop = () => this.stop

  setKeys(keys: readonly string[]) {
    this.keys = keys
    this.update()
  }

  draw(key: string, node: FocusableNode | null) {
    if (node === null) this.drawn.delete(key)
    else this.drawn.set(key, node)
    this.update()
  }

  focused(key: string) {
    this.active = key
    this.update()
  }

  /** Moves focus to the row a step away in the direction drawn. False at either end. */
  move(from: string, step: 'up' | 'down'): boolean {
    const down = step === 'down' ? !this.inverted : this.inverted
    const next = stepKey(this.keys, from, down ? 1 : -1)
    // A neighbour of a focused row is drawn: the window is many screens around what is in view.
    const node = next === null ? undefined : this.drawn.get(next)
    if (node === undefined) return false
    node.focus({ preventScroll: true })
    node.scrollIntoView?.({ block: 'nearest' })
    return true
  }

  private update() {
    const stop = stopKey(this.keys, new Set(this.drawn.keys()), this.active, this.entry)
    if (stop === this.stop) return
    this.stop = stop
    this.listeners.forEach((listener) => {
      listener()
    })
  }
}

export const ListFocusContext = createContext<ListFocus | null>(null)

/** The key of the list row being drawn, for whatever inside it is that row's stop. */
export const ListRowKey = createContext<string | null>(null)

const noSubscription = () => () => {}

/** Whether the row drawing this is its list's tab stop; null outside a list with roving focus. */
function useIsStop(): boolean | null {
  const focus = useContext(ListFocusContext)
  const key = useContext(ListRowKey)
  // Per row, so only the two rows whose answer flips re-render when the stop moves.
  const isStopNow = useCallback(
    () => (focus === null || key === null ? null : focus.currentStop() === key),
    [focus, key],
  )
  const isStop = useSyncExternalStore(focus?.subscribe ?? noSubscription, isStopNow, isStopNow)
  return isWeb ? isStop : null
}

/**
 * The tab index for a control inside a list row: a stop only in the row that is the list's stop,
 * so Tab goes from that row into its own controls and then out of the list.
 */
export function useListTabIndex(): 0 | -1 {
  return useIsStop() === false ? -1 : 0
}

interface ListStopKeyEvent {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  preventDefault: () => void
}

/**
 * What makes an element its row's stop in a list with roving focus: the tab index, the arrow
 * keys, and noting focus anywhere inside the row. Empty outside one, and on native, where a
 * screen reader moves between rows by its own gestures.
 */
export function useListStop() {
  const focus = useContext(ListFocusContext)
  const key = useContext(ListRowKey)
  const isStop = useIsStop()
  const ref = useCallback(
    (node: unknown) => {
      if (focus === null || key === null) return
      focus.draw(key, node as FocusableNode | null)
    },
    [focus, key],
  )
  if (isStop === null || focus === null || key === null) return null
  return {
    ref,
    tabIndex: isStop ? 0 : -1,
    onFocus: () => {
      focus.focused(key)
    },
    onKeyDown: (raw: unknown) => {
      const event = raw as ListStopKeyEvent
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      // At either end too: the scroller would otherwise move away from the focused row.
      event.preventDefault()
      focus.move(key, event.key === 'ArrowUp' ? 'up' : 'down')
    },
  } as const
}
